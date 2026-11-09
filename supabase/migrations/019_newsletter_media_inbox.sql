-- =====================================================
-- Ciento-Immobilier: Newsletter management, profile photos,
-- listing media and centralized contact inbox
-- =====================================================
-- Additive & idempotent. Existing tables are extended, never duplicated:
--   * newsletter_subscribers  → status, consent proof, archiving
--   * property_images/videos  → external links, moderation (= "property_media")
--   * notifications           → used as admin notifications
--   * profiles.avatar_url      → validated, stored in the "avatars" bucket
-- New: newsletter_consent_events, newsletter_campaigns, newsletter_campaign_logs,
--      contact_messages, contact_message_notes, contact_message_history, media_reports.
--
-- DEPLOYMENT ORDER: deploy the "media" Edge Function BEFORE applying this
-- migration: direct client uploads to Storage are closed here (uploads go
-- through signed upload URLs issued after server-side checks).
-- Rollback: supabase/rollbacks/019_newsletter_media_inbox.down.sql

BEGIN;

INSERT INTO public.site_settings (key, value, description) VALUES
  ('max_image_upload_mb', '5', 'Taille maximale d''une image d''annonce (Mo)'),
  ('max_video_upload_mb', '50', 'Taille maximale d''une vidéo d''annonce (Mo)'),
  ('max_videos_per_property', '3', 'Nombre maximum de vidéos par annonce'),
  ('max_avatar_upload_mb', '2', 'Taille maximale d''une photo de profil (Mo)'),
  ('contact_rate_limit_per_hour', '5', 'Messages de contact maximum par e-mail et par heure')
ON CONFLICT (key) DO NOTHING;

-- Request metadata helpers (PostgREST exposes the HTTP headers).
CREATE OR REPLACE FUNCTION public.request_ip_hash()
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT CASE WHEN ip IS NULL OR ip = '' THEN NULL
              ELSE encode(sha256(convert_to('ip:' || ip, 'UTF8')), 'hex') END
  FROM (
    SELECT btrim(split_part(COALESCE(
      NULLIF(current_setting('request.headers', TRUE), '')::JSON ->> 'x-forwarded-for',
      NULLIF(current_setting('request.headers', TRUE), '')::JSON ->> 'x-real-ip'), ',', 1)) AS ip
  ) AS h;
$$;

CREATE OR REPLACE FUNCTION public.request_user_agent()
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT left(NULLIF(current_setting('request.headers', TRUE), '')::JSON ->> 'user-agent', 300);
$$;

REVOKE ALL ON FUNCTION public.request_ip_hash() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.request_user_agent() FROM PUBLIC, anon, authenticated;

-- =====================================================
-- 1. NEWSLETTER — subscribers
-- =====================================================
ALTER TABLE public.newsletter_subscribers
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'website',
  ADD COLUMN IF NOT EXISTS consented_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_reason TEXT,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill from the legacy is_active / unsubscribed_at flags.
UPDATE public.newsletter_subscribers
SET status = CASE WHEN is_active THEN 'active' WHEN unsubscribed_at IS NOT NULL THEN 'unsubscribed' ELSE 'pending' END,
    consented_at = COALESCE(consented_at, created_at),
    confirmed_at = CASE WHEN is_active THEN COALESCE(confirmed_at, created_at) ELSE confirmed_at END
WHERE status IS NULL;

ALTER TABLE public.newsletter_subscribers ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE public.newsletter_subscribers ALTER COLUMN status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'newsletter_subscribers_status_check') THEN
    ALTER TABLE public.newsletter_subscribers
      ADD CONSTRAINT newsletter_subscribers_status_check
      CHECK (status IN ('pending', 'active', 'unsubscribed', 'suspended'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_newsletter_status_created ON public.newsletter_subscribers (status, created_at DESC);

-- Append-only proof of consent (survives status changes, removed with the subscriber).
CREATE TABLE IF NOT EXISTS public.newsletter_consent_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  subscriber_id UUID NOT NULL REFERENCES public.newsletter_subscribers(id) ON DELETE CASCADE,
  event TEXT NOT NULL CHECK (event IN (
    'subscription_requested', 'confirmed', 'unsubscribed', 'suspended', 'reactivated', 'archived', 'restored'
  )),
  source TEXT,
  ip_hash TEXT,
  user_agent TEXT,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_newsletter_consent_subscriber ON public.newsletter_consent_events (subscriber_id, created_at DESC);

ALTER TABLE public.newsletter_consent_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "newsletter_consent_admin_read" ON public.newsletter_consent_events;
CREATE POLICY "newsletter_consent_admin_read" ON public.newsletter_consent_events
  FOR SELECT USING (public.is_admin());

-- Keeps status and the legacy is_active flag consistent (the existing
-- confirm/unsubscribe RPCs keep working unchanged).
CREATE OR REPLACE FUNCTION public.sync_newsletter_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.status := CASE WHEN NEW.is_active THEN 'active' ELSE COALESCE(NULLIF(NEW.status, 'active'), 'pending') END;
    NEW.is_active := NEW.status = 'active';
    NEW.consented_at := COALESCE(NEW.consented_at, NOW());
    IF NEW.status = 'active' THEN NEW.confirmed_at := COALESCE(NEW.confirmed_at, NOW()); END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.is_active := NEW.status = 'active';
  ELSIF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    -- A suspended address cannot reactivate itself (only an administrator can).
    IF OLD.status = 'suspended' AND NOT public.is_admin() THEN
      NEW.is_active := FALSE;
      NEW.unsubscribed_at := OLD.unsubscribed_at;
      RETURN NEW;
    END IF;
    NEW.status := CASE WHEN NEW.is_active THEN 'active'
                       WHEN NEW.unsubscribed_at IS NOT NULL THEN 'unsubscribed'
                       ELSE 'pending' END;
  END IF;

  IF NEW.status = 'active' AND OLD.status <> 'active' THEN
    NEW.confirmed_at := NOW();
    NEW.unsubscribed_at := NULL;
    NEW.suspended_reason := NULL;
  ELSIF NEW.status = 'unsubscribed' AND OLD.status <> 'unsubscribed' THEN
    NEW.unsubscribed_at := COALESCE(NEW.unsubscribed_at, NOW());
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_newsletter_status ON public.newsletter_subscribers;
CREATE TRIGGER sync_newsletter_status
  BEFORE INSERT OR UPDATE ON public.newsletter_subscribers
  FOR EACH ROW EXECUTE FUNCTION public.sync_newsletter_status();

CREATE OR REPLACE FUNCTION public.log_newsletter_consent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
    INSERT INTO public.newsletter_consent_events (subscriber_id, event, actor_id)
    VALUES (NEW.id, CASE WHEN NEW.archived_at IS NULL THEN 'restored' ELSE 'archived' END, auth.uid());
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NULL;
  END IF;

  v_event := CASE NEW.status
    WHEN 'active' THEN CASE WHEN TG_OP = 'UPDATE' AND OLD.status = 'suspended' THEN 'reactivated' ELSE 'confirmed' END
    WHEN 'unsubscribed' THEN 'unsubscribed'
    WHEN 'suspended' THEN 'suspended'
    ELSE NULL
  END;
  IF v_event IS NOT NULL THEN
    INSERT INTO public.newsletter_consent_events (subscriber_id, event, actor_id)
    VALUES (NEW.id, v_event, auth.uid());
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.log_newsletter_consent() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS log_newsletter_consent ON public.newsletter_subscribers;
CREATE TRIGGER log_newsletter_consent
  AFTER INSERT OR UPDATE ON public.newsletter_subscribers
  FOR EACH ROW EXECUTE FUNCTION public.log_newsletter_consent();

-- Called by the newsletter-subscribe Edge Function: records how consent was given.
CREATE OR REPLACE FUNCTION public.record_newsletter_request(
  p_email TEXT, p_client_ip TEXT, p_user_agent TEXT, p_source TEXT DEFAULT 'website'
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.newsletter_consent_events (subscriber_id, event, source, ip_hash, user_agent)
  SELECT s.id, 'subscription_requested', left(p_source, 40),
         CASE WHEN p_client_ip IS NULL OR p_client_ip = 'unknown' THEN NULL
              ELSE encode(sha256(convert_to('ip:' || p_client_ip, 'UTF8')), 'hex') END,
         left(p_user_agent, 300)
  FROM public.newsletter_subscribers AS s
  WHERE lower(s.email) = lower(btrim(p_email));
$$;

REVOKE ALL ON FUNCTION public.record_newsletter_request(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_newsletter_request(TEXT, TEXT, TEXT, TEXT) TO service_role;

-- Admins may archive / delete (right to erasure).
DROP POLICY IF EXISTS "newsletter_admin_delete" ON public.newsletter_subscribers;
CREATE POLICY "newsletter_admin_delete" ON public.newsletter_subscribers
  FOR DELETE USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.admin_newsletter_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;
  RETURN (
    SELECT jsonb_build_object(
      'total', count(*) FILTER (WHERE archived_at IS NULL),
      'active', count(*) FILTER (WHERE status = 'active' AND archived_at IS NULL),
      'pending', count(*) FILTER (WHERE status = 'pending' AND archived_at IS NULL),
      'unsubscribed', count(*) FILTER (WHERE status = 'unsubscribed' AND archived_at IS NULL),
      'suspended', count(*) FILTER (WHERE status = 'suspended' AND archived_at IS NULL),
      'archived', count(*) FILTER (WHERE archived_at IS NOT NULL),
      'new_30_days', count(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days')
    )
    FROM public.newsletter_subscribers
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_newsletter_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_newsletter_stats() TO authenticated;

-- =====================================================
-- 2. NEWSLETTER — campaigns
-- =====================================================
CREATE TABLE IF NOT EXISTS public.newsletter_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL CHECK (char_length(subject) BETWEEN 3 AND 150),
  preheader TEXT CHECK (preheader IS NULL OR char_length(preheader) <= 200),
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 10 AND 50000),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sending', 'sent', 'partially_sent', 'failed', 'cancelled')),
  recipients_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  delivered_count INTEGER NOT NULL DEFAULT 0,
  opened_count INTEGER NOT NULL DEFAULT 0,
  clicked_count INTEGER NOT NULL DEFAULT 0,
  bounced_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  provider TEXT,
  last_error TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  sent_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.newsletter_campaign_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.newsletter_campaigns(id) ON DELETE CASCADE,
  subscriber_id UUID REFERENCES public.newsletter_subscribers(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN (
    'queued', 'sending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'failed'
  )),
  provider_message_id TEXT UNIQUE,
  error TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (campaign_id, subscriber_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_logs_status ON public.newsletter_campaign_logs (campaign_id, status);

DROP TRIGGER IF EXISTS update_newsletter_campaigns_updated_at ON public.newsletter_campaigns;
CREATE TRIGGER update_newsletter_campaigns_updated_at
  BEFORE UPDATE ON public.newsletter_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.newsletter_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_campaign_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campaigns_admin" ON public.newsletter_campaigns;
CREATE POLICY "campaigns_admin" ON public.newsletter_campaigns
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "campaign_logs_admin_read" ON public.newsletter_campaign_logs;
CREATE POLICY "campaign_logs_admin_read" ON public.newsletter_campaign_logs
  FOR SELECT USING (public.is_admin());

-- Content is frozen once sending started; counters/status belong to the server.
CREATE OR REPLACE FUNCTION public.protect_newsletter_campaign()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('postgres', 'service_role', 'supabase_admin') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.status := 'draft';
    NEW.created_by := auth.uid();
    NEW.recipients_count := 0; NEW.sent_count := 0; NEW.delivered_count := 0; NEW.opened_count := 0;
    NEW.clicked_count := 0; NEW.bounced_count := 0; NEW.failed_count := 0;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN
      RAISE EXCEPTION 'Une campagne envoyée ne peut pas être supprimée' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.status <> 'draft' THEN
    RAISE EXCEPTION 'Une campagne en cours ou envoyée ne peut plus être modifiée' USING ERRCODE = '42501';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status NOT IN ('draft', 'cancelled') THEN
    RAISE EXCEPTION 'Le statut d''envoi est géré par le serveur' USING ERRCODE = '42501';
  END IF;
  NEW.recipients_count := OLD.recipients_count; NEW.sent_count := OLD.sent_count;
  NEW.delivered_count := OLD.delivered_count; NEW.opened_count := OLD.opened_count;
  NEW.clicked_count := OLD.clicked_count; NEW.bounced_count := OLD.bounced_count; NEW.failed_count := OLD.failed_count;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_newsletter_campaign ON public.newsletter_campaigns;
CREATE TRIGGER protect_newsletter_campaign
  BEFORE INSERT OR UPDATE OR DELETE ON public.newsletter_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.protect_newsletter_campaign();

-- Step 1 (admin JWT): freeze the campaign and snapshot the active audience.
CREATE OR REPLACE FUNCTION public.admin_start_newsletter_campaign(p_campaign_id UUID, p_provider TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;

  UPDATE public.newsletter_campaigns
  SET status = 'sending', started_at = NOW(), sent_by = auth.uid(), provider = left(p_provider, 40), last_error = NULL
  WHERE id = p_campaign_id AND status = 'draft';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campagne introuvable ou déjà envoyée' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.newsletter_campaign_logs (campaign_id, subscriber_id, email)
  SELECT p_campaign_id, s.id, s.email
  FROM public.newsletter_subscribers AS s
  WHERE s.status = 'active' AND s.archived_at IS NULL
  ON CONFLICT (campaign_id, subscriber_id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  UPDATE public.newsletter_campaigns SET recipients_count = v_count WHERE id = p_campaign_id;

  IF v_count = 0 THEN
    UPDATE public.newsletter_campaigns SET status = 'failed', last_error = 'Aucun abonné actif', completed_at = NOW()
    WHERE id = p_campaign_id;
  END IF;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_start_newsletter_campaign(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_start_newsletter_campaign(UUID, TEXT) TO authenticated;

-- Step 2 (service_role): claim a batch; each recipient gets a one-click unsubscribe token.
CREATE OR REPLACE FUNCTION public.claim_newsletter_batch(p_campaign_id UUID, p_limit INTEGER DEFAULT 100)
RETURNS TABLE (log_id BIGINT, email TEXT, unsubscribe_token TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row RECORD;
  v_token TEXT;
BEGIN
  FOR v_row IN
    SELECT l.id, l.email, l.subscriber_id
    FROM public.newsletter_campaign_logs AS l
    JOIN public.newsletter_campaigns AS c ON c.id = l.campaign_id AND c.status = 'sending'
    JOIN public.newsletter_subscribers AS s ON s.id = l.subscriber_id
    WHERE l.campaign_id = p_campaign_id AND l.status = 'queued'
      AND s.status = 'active' -- unsubscribed meanwhile: not sent
    ORDER BY l.id
    LIMIT LEAST(GREATEST(p_limit, 1), 500)
    FOR UPDATE OF l SKIP LOCKED
  LOOP
    v_token := replace(gen_random_uuid()::TEXT, '-', '') || replace(gen_random_uuid()::TEXT, '-', '');
    INSERT INTO private.newsletter_unsubscribe_tokens (subscriber_id, token_hash, purpose, expires_at)
    VALUES (v_row.subscriber_id, sha256(convert_to(v_token, 'UTF8')), 'unsubscribe', NOW() + INTERVAL '1 year');
    UPDATE public.newsletter_campaign_logs SET status = 'sending', updated_at = NOW() WHERE id = v_row.id;
    log_id := v_row.id; email := v_row.email; unsubscribe_token := v_token;
    RETURN NEXT;
  END LOOP;

  -- Recipients who unsubscribed after the snapshot are dropped from the queue.
  UPDATE public.newsletter_campaign_logs AS l SET status = 'failed', error = 'unsubscribed_before_send', updated_at = NOW()
  FROM public.newsletter_subscribers AS s
  WHERE l.campaign_id = p_campaign_id AND l.status = 'queued' AND s.id = l.subscriber_id AND s.status <> 'active';
END;
$$;

-- Step 3 (service_role): store provider answers and finalize when nothing is left.
CREATE OR REPLACE FUNCTION public.record_newsletter_batch(p_campaign_id UUID, p_results JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_remaining INTEGER;
  v_sent INTEGER;
  v_failed INTEGER;
BEGIN
  UPDATE public.newsletter_campaign_logs AS l
  SET status = CASE WHEN r.ok THEN 'sent' ELSE 'failed' END,
      provider_message_id = r.message_id,
      error = CASE WHEN r.ok THEN NULL ELSE left(r.error, 300) END,
      sent_at = CASE WHEN r.ok THEN NOW() END,
      updated_at = NOW()
  FROM jsonb_to_recordset(p_results) AS r(log_id BIGINT, ok BOOLEAN, message_id TEXT, error TEXT)
  WHERE l.id = r.log_id AND l.campaign_id = p_campaign_id AND l.status = 'sending';

  SELECT count(*) FILTER (WHERE status IN ('queued', 'sending')),
         count(*) FILTER (WHERE status NOT IN ('queued', 'sending', 'failed')),
         count(*) FILTER (WHERE status = 'failed')
  INTO v_remaining, v_sent, v_failed
  FROM public.newsletter_campaign_logs WHERE campaign_id = p_campaign_id;

  UPDATE public.newsletter_campaigns
  SET sent_count = v_sent, failed_count = v_failed,
      status = CASE WHEN v_remaining > 0 THEN 'sending'
                    WHEN v_sent = 0 THEN 'failed'
                    WHEN v_failed > 0 THEN 'partially_sent'
                    ELSE 'sent' END,
      completed_at = CASE WHEN v_remaining = 0 THEN NOW() END
  WHERE id = p_campaign_id;

  RETURN jsonb_build_object('remaining', v_remaining, 'sent', v_sent, 'failed', v_failed);
END;
$$;

-- Provider webhooks (delivery, opens, clicks, bounces). Counters move only on
-- the first occurrence of each event for a given message.
CREATE OR REPLACE FUNCTION public.record_email_event(p_message_id TEXT, p_event TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_log public.newsletter_campaign_logs%ROWTYPE;
BEGIN
  SELECT * INTO v_log FROM public.newsletter_campaign_logs WHERE provider_message_id = p_message_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  IF p_event = 'delivered' AND v_log.delivered_at IS NULL THEN
    UPDATE public.newsletter_campaign_logs SET delivered_at = NOW(),
      status = CASE WHEN status IN ('sent', 'sending') THEN 'delivered' ELSE status END, updated_at = NOW() WHERE id = v_log.id;
    UPDATE public.newsletter_campaigns SET delivered_count = delivered_count + 1 WHERE id = v_log.campaign_id;
  ELSIF p_event = 'opened' AND v_log.opened_at IS NULL THEN
    UPDATE public.newsletter_campaign_logs SET opened_at = NOW(),
      status = CASE WHEN status <> 'clicked' THEN 'opened' ELSE status END, updated_at = NOW() WHERE id = v_log.id;
    UPDATE public.newsletter_campaigns SET opened_count = opened_count + 1 WHERE id = v_log.campaign_id;
  ELSIF p_event = 'clicked' AND v_log.clicked_at IS NULL THEN
    UPDATE public.newsletter_campaign_logs SET clicked_at = NOW(), status = 'clicked', updated_at = NOW() WHERE id = v_log.id;
    UPDATE public.newsletter_campaigns SET clicked_count = clicked_count + 1 WHERE id = v_log.campaign_id;
  ELSIF p_event IN ('bounced', 'complained') AND v_log.status NOT IN ('bounced', 'complained') THEN
    UPDATE public.newsletter_campaign_logs SET status = p_event, updated_at = NOW() WHERE id = v_log.id;
    UPDATE public.newsletter_campaigns SET bounced_count = bounced_count + 1 WHERE id = v_log.campaign_id;
    -- Hard bounces and spam complaints stop future sends to this address.
    UPDATE public.newsletter_subscribers
    SET status = 'suspended', suspended_reason = 'email_' || p_event
    WHERE id = v_log.subscriber_id AND status = 'active';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_newsletter_batch(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_newsletter_batch(UUID, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_email_event(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_newsletter_batch(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_newsletter_batch(UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_email_event(TEXT, TEXT) TO service_role;

-- =====================================================
-- 3. CONTACT INBOX
-- =====================================================
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 120),
  email TEXT NOT NULL CHECK (char_length(email) <= 254 AND email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
  phone TEXT CHECK (phone IS NULL OR char_length(phone) <= 30),
  subject TEXT NOT NULL CHECK (char_length(subject) BETWEEN 2 AND 150),
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 10 AND 5000),
  source TEXT NOT NULL DEFAULT 'contact_page'
    CHECK (source IN ('contact_page', 'property', 'agency', 'service', 'other')),
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  agency_id UUID REFERENCES public.agencies(id) ON DELETE SET NULL,
  related_id UUID,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'replied', 'resolved', 'archived')),
  read_at TIMESTAMPTZ,
  read_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  replied_at TIMESTAMPTZ,
  replied_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ip_hash TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON public.contact_messages (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_messages_unread ON public.contact_messages (created_at DESC) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contact_messages_email ON public.contact_messages (lower(email), created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_messages_ip ON public.contact_messages (ip_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_messages_agency ON public.contact_messages (agency_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.contact_message_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.contact_messages(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.contact_message_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.contact_messages(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_notes_message ON public.contact_message_notes (message_id, created_at);
CREATE INDEX IF NOT EXISTS idx_contact_history_message ON public.contact_message_history (message_id, created_at);

DROP TRIGGER IF EXISTS update_contact_messages_updated_at ON public.contact_messages;
CREATE TRIGGER update_contact_messages_updated_at
  BEFORE UPDATE ON public.contact_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_message_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_message_history ENABLE ROW LEVEL SECURITY;

-- Visitors' messages are private: admins only (+ the agency for messages sent to it).
DROP POLICY IF EXISTS "contact_messages_select" ON public.contact_messages;
CREATE POLICY "contact_messages_select" ON public.contact_messages
  FOR SELECT USING (
    public.is_admin() OR (source = 'agency' AND public.has_agency_permission(agency_id, 'leads'))
  );
DROP POLICY IF EXISTS "contact_messages_admin_update" ON public.contact_messages;
CREATE POLICY "contact_messages_admin_update" ON public.contact_messages
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "contact_messages_super_delete" ON public.contact_messages;
CREATE POLICY "contact_messages_super_delete" ON public.contact_messages
  FOR DELETE USING (public.is_super_admin());

DROP POLICY IF EXISTS "contact_notes_admin_read" ON public.contact_message_notes;
CREATE POLICY "contact_notes_admin_read" ON public.contact_message_notes
  FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "contact_notes_admin_insert" ON public.contact_message_notes;
CREATE POLICY "contact_notes_admin_insert" ON public.contact_message_notes
  FOR INSERT WITH CHECK (public.is_admin() AND author_id = auth.uid());
DROP POLICY IF EXISTS "contact_history_admin_read" ON public.contact_message_history;
CREATE POLICY "contact_history_admin_read" ON public.contact_message_history
  FOR SELECT USING (public.is_admin());

-- Message content is evidence: never rewritten; every workflow change is journaled.
CREATE OR REPLACE FUNCTION public.track_contact_message_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF ROW(NEW.full_name, NEW.email, NEW.phone, NEW.subject, NEW.message, NEW.source, NEW.created_at, NEW.ip_hash)
     IS DISTINCT FROM ROW(OLD.full_name, OLD.email, OLD.phone, OLD.subject, OLD.message, OLD.source, OLD.created_at, OLD.ip_hash) THEN
    RAISE EXCEPTION 'Le contenu d''un message reçu ne peut pas être modifié' USING ERRCODE = '42501';
  END IF;

  IF NEW.read_at IS NOT NULL AND OLD.read_at IS NULL THEN
    NEW.read_by := auth.uid();
    INSERT INTO public.contact_message_history (message_id, actor_id, action) VALUES (NEW.id, auth.uid(), 'read');
  ELSIF NEW.read_at IS NULL AND OLD.read_at IS NOT NULL THEN
    NEW.read_by := NULL;
    INSERT INTO public.contact_message_history (message_id, actor_id, action) VALUES (NEW.id, auth.uid(), 'marked_unread');
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'replied' AND OLD.status <> 'replied' THEN
      NEW.replied_at := NOW();
      NEW.replied_by := auth.uid();
    END IF;
    IF NEW.read_at IS NULL THEN NEW.read_at := NOW(); NEW.read_by := auth.uid(); END IF;
    INSERT INTO public.contact_message_history (message_id, actor_id, action, from_status, to_status)
    VALUES (NEW.id, auth.uid(), 'status_changed', OLD.status, NEW.status);
  END IF;

  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    IF NEW.assigned_to IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE id = NEW.assigned_to AND role IN ('admin', 'super_admin') AND is_active
    ) THEN
      RAISE EXCEPTION 'Un message ne peut être assigné qu''à un administrateur' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.contact_message_history (message_id, actor_id, action, details)
    VALUES (NEW.id, auth.uid(), 'assigned', jsonb_build_object('assigned_to', NEW.assigned_to));
    IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to <> COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::UUID) THEN
      INSERT INTO public.notifications (user_id, type, title, message, link)
      VALUES (NEW.assigned_to, 'message', 'Message assigné', format('« %s » vous a été assigné.', NEW.subject),
              '/admin/messages?id=' || NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.track_contact_message_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS track_contact_message_change ON public.contact_messages;
CREATE TRIGGER track_contact_message_change
  BEFORE UPDATE ON public.contact_messages
  FOR EACH ROW EXECUTE FUNCTION public.track_contact_message_change();

CREATE OR REPLACE FUNCTION public.track_contact_note()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.contact_message_history (message_id, actor_id, action)
  VALUES (NEW.message_id, NEW.author_id, 'note_added');
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.track_contact_note() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS track_contact_note ON public.contact_message_notes;
CREATE TRIGGER track_contact_note
  AFTER INSERT ON public.contact_message_notes
  FOR EACH ROW EXECUTE FUNCTION public.track_contact_note();

-- Admin notifications reuse the existing notifications table (one row per admin).
CREATE OR REPLACE FUNCTION public.notify_admins(p_title TEXT, p_message TEXT, p_link TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.notifications (user_id, type, title, message, link)
  SELECT pr.id, 'message', p_title, left(p_message, 300), p_link
  FROM public.profiles AS pr
  WHERE pr.role IN ('admin', 'super_admin') AND pr.is_active;
$$;

REVOKE ALL ON FUNCTION public.notify_admins(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- Public entry point for every contact form (rate-limited by e-mail and IP).
CREATE OR REPLACE FUNCTION public.submit_contact_message(
  p_full_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_subject TEXT,
  p_message TEXT,
  p_source TEXT DEFAULT 'contact_page',
  p_property_id UUID DEFAULT NULL,
  p_agency_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email TEXT := lower(btrim(p_email));
  v_ip TEXT := public.request_ip_hash();
  v_limit INTEGER := public.setting_int('contact_rate_limit_per_hour', 5);
  v_id UUID;
  v_agency_owner UUID;
BEGIN
  IF p_source NOT IN ('contact_page', 'agency', 'other') THEN
    RAISE EXCEPTION 'Source invalide' USING ERRCODE = '22023';
  END IF;

  IF (SELECT count(*) FROM public.contact_messages
      WHERE lower(email) = v_email AND created_at > NOW() - INTERVAL '1 hour') >= v_limit
     OR (v_ip IS NOT NULL AND (SELECT count(*) FROM public.contact_messages
         WHERE ip_hash = v_ip AND created_at > NOW() - INTERVAL '1 hour') >= v_limit * 2) THEN
    RAISE EXCEPTION 'Trop de messages envoyés. Réessayez plus tard.' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (SELECT 1 FROM public.contact_messages
             WHERE lower(email) = v_email AND message = btrim(p_message) AND created_at > NOW() - INTERVAL '1 day') THEN
    RAISE EXCEPTION 'Ce message a déjà été envoyé.' USING ERRCODE = 'P0001';
  END IF;

  IF p_source = 'agency' THEN
    SELECT owner_id INTO v_agency_owner FROM public.agencies WHERE id = p_agency_id AND is_active AND is_verified;
    IF v_agency_owner IS NULL THEN
      RAISE EXCEPTION 'Agence indisponible' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  INSERT INTO public.contact_messages (full_name, email, phone, subject, message, source, property_id, agency_id,
                                       sender_id, ip_hash, user_agent)
  VALUES (btrim(p_full_name), v_email, NULLIF(btrim(p_phone), ''), btrim(p_subject), btrim(p_message), p_source,
          (SELECT id FROM public.properties WHERE id = p_property_id AND is_published AND status = 'active'),
          CASE WHEN p_source = 'agency' THEN p_agency_id END,
          auth.uid(), v_ip, public.request_user_agent())
  RETURNING id INTO v_id;

  PERFORM public.notify_admins('Nouveau message de contact', format('%s — %s', btrim(p_full_name), btrim(p_subject)),
                               '/admin/messages?id=' || v_id);
  IF v_agency_owner IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (v_agency_owner, 'message', 'Nouveau message pour votre agence', btrim(p_subject), '/dashboard/prospects?espace=agence');
  END IF;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_contact_message(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_contact_message(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID) TO anon, authenticated;

-- Listing inquiries and service requests are mirrored into the central inbox
-- (they keep their own workflow for owners / service team).
CREATE OR REPLACE FUNCTION public.mirror_to_contact_inbox()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_TABLE_NAME = 'property_inquiries' THEN
    INSERT INTO public.contact_messages (full_name, email, phone, subject, message, source, property_id, agency_id,
                                         related_id, sender_id, ip_hash, user_agent)
    SELECT NEW.full_name, NEW.email, NEW.phone, left('Annonce : ' || p.title, 150), NEW.message, 'property',
           NEW.property_id, NEW.agency_id, NEW.id, NEW.sender_id, public.request_ip_hash(), public.request_user_agent()
    FROM public.properties AS p WHERE p.id = NEW.property_id;
  ELSE
    INSERT INTO public.contact_messages (full_name, email, phone, subject, message, source, property_id,
                                         related_id, sender_id, ip_hash, user_agent)
    SELECT NEW.full_name, NEW.email, NEW.phone, left('Service : ' || c.name, 150),
           left(NEW.message, 5000) || CASE WHEN NEW.city IS NOT NULL THEN E'\n\nVille : ' || NEW.city ELSE '' END,
           'service', NEW.property_id, NEW.id, NEW.user_id, public.request_ip_hash(), public.request_user_agent()
    FROM public.service_categories AS c WHERE c.id = NEW.category_id;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.mirror_to_contact_inbox() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS mirror_inquiry_to_inbox ON public.property_inquiries;
CREATE TRIGGER mirror_inquiry_to_inbox
  AFTER INSERT ON public.property_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.mirror_to_contact_inbox();

DROP TRIGGER IF EXISTS mirror_service_request_to_inbox ON public.service_requests;
CREATE TRIGGER mirror_service_request_to_inbox
  AFTER INSERT ON public.service_requests
  FOR EACH ROW EXECUTE FUNCTION public.mirror_to_contact_inbox();

CREATE OR REPLACE FUNCTION public.admin_inbox_counts()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;
  RETURN (
    SELECT jsonb_build_object(
      'all', count(*) FILTER (WHERE status <> 'archived'),
      -- Listing inquiries are handled by owners: they do not inflate the admin badge.
      'unread', count(*) FILTER (WHERE read_at IS NULL AND status <> 'archived' AND source <> 'property'),
      'read', count(*) FILTER (WHERE read_at IS NOT NULL AND status <> 'archived'),
      'pending', count(*) FILTER (WHERE status = 'pending'),
      'in_progress', count(*) FILTER (WHERE status = 'in_progress'),
      'replied', count(*) FILTER (WHERE status IN ('replied', 'resolved')),
      'archived', count(*) FILTER (WHERE status = 'archived')
    )
    FROM public.contact_messages
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_inbox_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_inbox_counts() TO authenticated;

-- =====================================================
-- 4. LISTING MEDIA (extends property_images / property_videos)
-- =====================================================
ALTER TABLE public.property_images
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'upload',
  ADD COLUMN IF NOT EXISTS external_url TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_path TEXT,
  ADD COLUMN IF NOT EXISTS mime_type TEXT,
  ADD COLUMN IF NOT EXISTS size_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS moderation_note TEXT,
  ADD COLUMN IF NOT EXISTS flag_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.property_images ALTER COLUMN storage_path DROP NOT NULL;

ALTER TABLE public.property_videos
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'upload',
  ADD COLUMN IF NOT EXISTS provider_video_id TEXT,
  ADD COLUMN IF NOT EXISTS mime_type TEXT,
  ADD COLUMN IF NOT EXISTS size_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS moderation_note TEXT,
  ADD COLUMN IF NOT EXISTS flag_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'property_images_source_check') THEN
    ALTER TABLE public.property_images ADD CONSTRAINT property_images_source_check CHECK (
      (source = 'upload' AND storage_path IS NOT NULL)
      OR (source = 'external' AND external_url ~ '^https://[^\s"''<>]+$' AND char_length(external_url) <= 2000)) NOT VALID;
    ALTER TABLE public.property_images ADD CONSTRAINT property_images_moderation_check
      CHECK (moderation_status IN ('approved', 'flagged', 'removed'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'property_videos_source_check') THEN
    ALTER TABLE public.property_videos ADD CONSTRAINT property_videos_source_check CHECK (
      (source = 'upload' AND storage_path IS NOT NULL)
      OR (source = 'youtube' AND provider_video_id ~ '^[A-Za-z0-9_-]{11}$')
      OR (source = 'vimeo' AND provider_video_id ~ '^[0-9]{6,12}$')
      OR (source = 'external' AND url ~* '^https://[^\s"''<>]+\.(mp4|webm)(\?[^\s"''<>]*)?$')) NOT VALID;
    ALTER TABLE public.property_videos ADD CONSTRAINT property_videos_moderation_check
      CHECK (moderation_status IN ('approved', 'flagged', 'removed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_property_images_moderation ON public.property_images (moderation_status) WHERE moderation_status <> 'approved';
CREATE INDEX IF NOT EXISTS idx_property_videos_property ON public.property_videos (property_id, sort_order);

-- Removed media disappear from public listings (owners and admins still see them).
DROP POLICY IF EXISTS "property_images_select_public" ON public.property_images;
CREATE POLICY "property_images_select_public" ON public.property_images
  FOR SELECT USING (
    (moderation_status <> 'removed' AND property_id IN (
      SELECT id FROM public.properties WHERE is_published AND status = 'active'))
    OR property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "property_videos_select_public" ON public.property_videos;
CREATE POLICY "property_videos_select_public" ON public.property_videos
  FOR SELECT USING (
    (moderation_status <> 'removed' AND property_id IN (
      SELECT id FROM public.properties WHERE is_published AND status = 'active'))
    OR property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "property_videos_manage_agency" ON public.property_videos;
CREATE POLICY "property_videos_manage_agency" ON public.property_videos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.properties AS p WHERE p.id = property_id AND public.has_agency_permission(p.agency_id, 'publish'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.properties AS p WHERE p.id = property_id AND public.has_agency_permission(p.agency_id, 'publish'))
  );

-- Owners may add external links and reorder; uploaded files are registered only
-- by the media Edge Function (service_role) after server-side verification.
-- Exposes only the media limits (site_settings stays private).
CREATE OR REPLACE FUNCTION public.media_limit(p_table TEXT)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT CASE p_table
    WHEN 'property_images' THEN public.setting_int('max_images_per_property', 20)
    ELSE public.setting_int('max_videos_per_property', 3) END;
$$;

REVOKE ALL ON FUNCTION public.media_limit(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.media_limit(TEXT) TO authenticated;

-- Not SECURITY DEFINER on purpose: current_user is the real caller, so trusted
-- server code (service_role, SECURITY DEFINER RPCs owned by postgres) passes.
CREATE OR REPLACE FUNCTION public.guard_property_media()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_count INTEGER;
  v_max INTEGER;
BEGIN
  IF current_user IN ('postgres', 'service_role', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.source = 'upload' THEN
      RAISE EXCEPTION 'Les fichiers doivent être envoyés via le service de téléversement' USING ERRCODE = '42501';
    END IF;
    NEW.uploaded_by := auth.uid();
    NEW.moderation_status := 'approved';
    NEW.flag_count := 0;
    IF TG_TABLE_NAME = 'property_images' THEN
      NEW.storage_path := NULL;
      NEW.url := NEW.external_url;
      SELECT count(*) INTO v_count FROM public.property_images WHERE property_id = NEW.property_id;
      v_max := public.media_limit(TG_TABLE_NAME);
    ELSE
      NEW.storage_path := NULL;
      NEW.url := CASE NEW.source
        WHEN 'youtube' THEN 'https://www.youtube.com/watch?v=' || NEW.provider_video_id
        WHEN 'vimeo' THEN 'https://vimeo.com/' || NEW.provider_video_id
        ELSE NEW.url END;
      SELECT count(*) INTO v_count FROM public.property_videos WHERE property_id = NEW.property_id;
      v_max := public.media_limit(TG_TABLE_NAME);
    END IF;
    IF v_count >= v_max THEN
      RAISE EXCEPTION 'Nombre maximum de médias atteint (%)', v_max USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: file identity and moderation fields are server-managed.
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF NEW.source IS DISTINCT FROM OLD.source OR NEW.storage_path IS DISTINCT FROM OLD.storage_path
     OR NEW.url IS DISTINCT FROM OLD.url OR NEW.property_id IS DISTINCT FROM OLD.property_id
     OR NEW.moderation_status IS DISTINCT FROM OLD.moderation_status OR NEW.flag_count IS DISTINCT FROM OLD.flag_count THEN
    RAISE EXCEPTION 'Seuls l''ordre, le titre et l''image principale sont modifiables' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_property_media() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_property_images ON public.property_images;
CREATE TRIGGER guard_property_images
  BEFORE INSERT OR UPDATE ON public.property_images
  FOR EACH ROW EXECUTE FUNCTION public.guard_property_media();

DROP TRIGGER IF EXISTS guard_property_videos ON public.property_videos;
CREATE TRIGGER guard_property_videos
  BEFORE INSERT OR UPDATE ON public.property_videos
  FOR EACH ROW EXECUTE FUNCTION public.guard_property_media();

-- Single unified view for the admin media console (RLS of the base tables applies).
CREATE OR REPLACE VIEW public.property_media WITH (security_invoker = true) AS
  SELECT i.id, 'image'::TEXT AS media_type, i.property_id, i.source, i.url, i.storage_path, i.thumbnail_path,
         NULL::TEXT AS provider_video_id, i.is_primary, i.sort_order, i.mime_type, i.size_bytes,
         i.moderation_status, i.moderation_note, i.flag_count, i.uploaded_by, i.created_at
  FROM public.property_images AS i
  UNION ALL
  SELECT v.id, 'video'::TEXT, v.property_id, v.source, v.url, v.storage_path, v.thumbnail_url,
         v.provider_video_id, FALSE, v.sort_order, v.mime_type, v.size_bytes,
         v.moderation_status, v.moderation_note, v.flag_count, v.uploaded_by, v.created_at
  FROM public.property_videos AS v;

-- Reports from visitors (one per user and media).
CREATE TABLE IF NOT EXISTS public.media_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  media_id UUID NOT NULL,
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (media_type, media_id, reporter_id)
);

ALTER TABLE public.media_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "media_reports_admin_read" ON public.media_reports;
CREATE POLICY "media_reports_admin_read" ON public.media_reports FOR SELECT USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.report_property_media(p_media_type TEXT, p_media_id UUID, p_reason TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous pour signaler un média' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.media_reports (media_type, media_id, reporter_id, reason)
  VALUES (p_media_type, p_media_id, auth.uid(), btrim(p_reason))
  ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN; END IF;

  IF p_media_type = 'image' THEN
    UPDATE public.property_images SET flag_count = flag_count + 1,
      moderation_status = CASE WHEN moderation_status = 'approved' THEN 'flagged' ELSE moderation_status END
    WHERE id = p_media_id;
  ELSE
    UPDATE public.property_videos SET flag_count = flag_count + 1,
      moderation_status = CASE WHEN moderation_status = 'approved' THEN 'flagged' ELSE moderation_status END
    WHERE id = p_media_id;
  END IF;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Média introuvable' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public.notify_admins('Média signalé', btrim(p_reason), '/admin/medias?filtre=flagged');
END;
$$;

REVOKE ALL ON FUNCTION public.report_property_media(TEXT, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_property_media(TEXT, UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_moderate_media(p_media_type TEXT, p_media_id UUID, p_status TEXT, p_note TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('approved', 'removed') THEN
    RAISE EXCEPTION 'Décision invalide' USING ERRCODE = '22023';
  END IF;
  IF p_media_type = 'image' THEN
    UPDATE public.property_images SET moderation_status = p_status, moderation_note = left(p_note, 500),
      flag_count = CASE WHEN p_status = 'approved' THEN 0 ELSE flag_count END
    WHERE id = p_media_id;
  ELSE
    UPDATE public.property_videos SET moderation_status = p_status, moderation_note = left(p_note, 500),
      flag_count = CASE WHEN p_status = 'approved' THEN 0 ELSE flag_count END
    WHERE id = p_media_id;
  END IF;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Média introuvable' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public.write_audit_log('moderate_media', 'property_' || p_media_type || 's', p_media_id::TEXT, NULL,
                                 jsonb_build_object('status', p_status), p_note);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_moderate_media(TEXT, UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_moderate_media(TEXT, UUID, TEXT, TEXT) TO authenticated;

-- Storage objects not referenced by any row (abandoned uploads, deleted listings).
CREATE OR REPLACE FUNCTION public.list_orphan_media_objects(p_older_than INTERVAL DEFAULT INTERVAL '24 hours')
RETURNS TABLE (bucket_id TEXT, name TEXT)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT o.bucket_id, o.name
  FROM storage.objects AS o
  WHERE o.created_at < NOW() - p_older_than
    AND (
      (o.bucket_id IN ('property-images', 'property-videos')
        AND NOT EXISTS (SELECT 1 FROM public.property_images AS i WHERE i.storage_path = o.name OR i.thumbnail_path = o.name)
        AND NOT EXISTS (SELECT 1 FROM public.property_videos AS v WHERE v.storage_path = o.name))
      OR (o.bucket_id = 'avatars'
        AND NOT EXISTS (SELECT 1 FROM public.profiles AS p WHERE p.avatar_url LIKE '%/avatars/' || o.name))
    )
  LIMIT 1000;
$$;

REVOKE ALL ON FUNCTION public.list_orphan_media_objects(INTERVAL) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_orphan_media_objects(INTERVAL) TO service_role;

-- =====================================================
-- 5. PROFILE PHOTO
-- =====================================================
-- avatar_url may only point to the user's own folder of the avatars bucket.
CREATE OR REPLACE FUNCTION public.validate_profile_avatar()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.avatar_url IS NOT DISTINCT FROM OLD.avatar_url OR NEW.avatar_url IS NULL
     OR current_user IN ('postgres', 'service_role', 'supabase_admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.avatar_url !~ ('^https://[^/\s]+/storage/v1/object/public/avatars/' || NEW.id::TEXT || '/[A-Za-z0-9._-]+$') THEN
    RAISE EXCEPTION 'Photo de profil invalide' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_profile_avatar ON public.profiles;
CREATE TRIGGER validate_profile_avatar
  BEFORE UPDATE OF avatar_url ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_profile_avatar();

-- =====================================================
-- 6. STORAGE: buckets & policies
-- =====================================================
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NULL THEN
    RAISE NOTICE 'Schéma storage absent : buckets non configurés.';
    RETURN;
  END IF;

  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
    ('avatars', 'avatars', TRUE, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp']),
    ('property-videos', 'property-videos', FALSE, 52428800, ARRAY['video/mp4', 'video/webm'])
  ON CONFLICT (id) DO NOTHING;

  -- Listing images: same formats as before minus GIF (spec: JPG/PNG/WebP).
  UPDATE storage.buckets SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'] WHERE id = 'property-images';

  -- Direct client writes are closed: the media Edge Function issues signed upload URLs.
  EXECUTE 'DROP POLICY IF EXISTS "property_images_auth_insert" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "property_images_auth_update" ON storage.objects';

  EXECUTE 'DROP POLICY IF EXISTS "avatars_public_select" ON storage.objects';
  EXECUTE 'CREATE POLICY "avatars_public_select" ON storage.objects FOR SELECT USING (bucket_id = ''avatars'')';
  EXECUTE 'DROP POLICY IF EXISTS "avatars_owner_delete" ON storage.objects';
  EXECUTE 'CREATE POLICY "avatars_owner_delete" ON storage.objects FOR DELETE TO authenticated
           USING (bucket_id = ''avatars'' AND (storage.foldername(name))[1] = auth.uid()::TEXT)';

  EXECUTE 'DROP POLICY IF EXISTS "property_videos_select" ON storage.objects';
  EXECUTE 'CREATE POLICY "property_videos_select" ON storage.objects FOR SELECT
           USING (bucket_id = ''property-videos'' AND public.can_view_property_object(name))';
  EXECUTE 'DROP POLICY IF EXISTS "property_videos_delete" ON storage.objects';
  EXECUTE 'CREATE POLICY "property_videos_delete" ON storage.objects FOR DELETE TO authenticated
           USING (bucket_id = ''property-videos'' AND public.can_manage_property_object(name))';
END $$;

-- =====================================================
-- 7. Realtime (admin inbox & notifications without page reloads)
-- =====================================================
DO $$
DECLARE
  t TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['contact_messages', 'notifications'] LOOP
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END $$;

-- =====================================================
-- 8. Audit
-- =====================================================
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['newsletter_campaigns', 'newsletter_subscribers', 'contact_messages'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%1$s ON public.%1$I', t);
    EXECUTE format('CREATE TRIGGER audit_%1$s AFTER UPDATE OR DELETE ON public.%1$I
                    FOR EACH ROW EXECUTE FUNCTION public.audit_row_change()', t);
  END LOOP;
END $$;

COMMIT;
