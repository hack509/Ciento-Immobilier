-- Security hardening for projects where migrations 001-013 are already applied.

BEGIN;

-- Profiles contain private contact information. Public-facing queries use the
-- deliberately limited view below; direct profile reads are private.
DROP POLICY IF EXISTS "profiles_select_public" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
  FOR SELECT
  USING (id = auth.uid() OR public.is_admin());

REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT ON public.profiles TO authenticated;

CREATE OR REPLACE VIEW public.public_profiles
WITH (security_barrier = true, security_invoker = false)
AS
SELECT p.id, p.first_name, p.last_name, p.avatar_url, p.bio
FROM public.profiles AS p
WHERE p.is_active
  AND (
    EXISTS (
      SELECT 1
      FROM public.agents AS a
      WHERE a.profile_id = p.id AND a.is_active
    )
    OR EXISTS (
      SELECT 1
      FROM public.agencies AS ag
      WHERE ag.owner_id = p.id AND ag.is_active
    )
    OR EXISTS (
      SELECT 1
      FROM public.properties AS pr
      WHERE pr.owner_id = p.id AND pr.is_published AND pr.status = 'active'
    )
  );

REVOKE ALL ON public.public_profiles FROM PUBLIC;
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- Do not allow direct email-based newsletter updates. A backend with a
-- verified email-delivery provider issues the one-time token; the public RPC
-- below can only consume a valid, unexpired token.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

CREATE TABLE IF NOT EXISTS private.newsletter_unsubscribe_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id UUID NOT NULL
    REFERENCES public.newsletter_subscribers(id) ON DELETE CASCADE,
  token_hash BYTEA NOT NULL UNIQUE,
  purpose TEXT NOT NULL CHECK (purpose IN ('confirm', 'unsubscribe')),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_newsletter_unsubscribe_tokens_expires
  ON private.newsletter_unsubscribe_tokens (expires_at);

ALTER TABLE private.newsletter_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.newsletter_unsubscribe_tokens FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON private.newsletter_unsubscribe_tokens TO service_role;

CREATE TABLE IF NOT EXISTS private.newsletter_request_limits (
  key_hash BYTEA PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL CHECK (request_count > 0)
);

CREATE INDEX IF NOT EXISTS idx_newsletter_request_limits_window
  ON private.newsletter_request_limits (window_started_at);

ALTER TABLE private.newsletter_request_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.newsletter_request_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON private.newsletter_request_limits TO service_role;

DROP POLICY IF EXISTS "newsletter_subscribe" ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "newsletter_unsubscribe" ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "newsletter_admin_update" ON public.newsletter_subscribers;
REVOKE INSERT ON public.newsletter_subscribers FROM anon, authenticated;
CREATE POLICY "newsletter_admin_update" ON public.newsletter_subscribers
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.normalize_newsletter_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.email := pg_catalog.lower(pg_catalog.btrim(NEW.email));
  IF NEW.email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' THEN
    RAISE EXCEPTION 'Adresse e-mail invalide' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_newsletter_email ON public.newsletter_subscribers;
CREATE TRIGGER normalize_newsletter_email
  BEFORE INSERT OR UPDATE OF email ON public.newsletter_subscribers
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_newsletter_email();

CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_email_lower
  ON public.newsletter_subscribers (pg_catalog.lower(email));

CREATE OR REPLACE FUNCTION public.create_newsletter_unsubscribe_token(p_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_subscriber_id UUID;
  v_token TEXT;
BEGIN
  SELECT subscriber.id
  INTO v_subscriber_id
  FROM public.newsletter_subscribers AS subscriber
  WHERE subscriber.email = pg_catalog.lower(pg_catalog.btrim(p_email))
    AND subscriber.is_active;

  IF v_subscriber_id IS NULL THEN
    RETURN NULL;
  END IF;

  DELETE FROM private.newsletter_unsubscribe_tokens
  WHERE subscriber_id = v_subscriber_id;

  v_token := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');

  INSERT INTO private.newsletter_unsubscribe_tokens (
    subscriber_id,
    token_hash,
    purpose,
    expires_at
  )
  VALUES (
    v_subscriber_id,
    extensions.digest(pg_catalog.convert_to(v_token, 'UTF8'), 'sha256'),
    'unsubscribe',
    pg_catalog.now() + INTERVAL '7 days'
  );

  RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.create_newsletter_unsubscribe_token(TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_newsletter_unsubscribe_token(TEXT)
  TO service_role;

CREATE OR REPLACE FUNCTION private.allow_newsletter_request(
  p_key_hash BYTEA,
  p_max_requests INTEGER,
  p_window INTERVAL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request_count INTEGER;
BEGIN
  DELETE FROM private.newsletter_request_limits
  WHERE window_started_at < pg_catalog.now() - INTERVAL '7 days';

  INSERT INTO private.newsletter_request_limits (key_hash, window_started_at, request_count)
  VALUES (p_key_hash, pg_catalog.now(), 1)
  ON CONFLICT (key_hash) DO UPDATE
  SET window_started_at = CASE
        WHEN private.newsletter_request_limits.window_started_at
             <= pg_catalog.now() - p_window
          THEN pg_catalog.now()
        ELSE private.newsletter_request_limits.window_started_at
      END,
      request_count = CASE
        WHEN private.newsletter_request_limits.window_started_at
             <= pg_catalog.now() - p_window
          THEN 1
        ELSE private.newsletter_request_limits.request_count + 1
      END
  RETURNING request_count INTO v_request_count;

  RETURN v_request_count <= p_max_requests;
END;
$$;

REVOKE ALL ON FUNCTION private.allow_newsletter_request(BYTEA, INTEGER, INTERVAL)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.request_newsletter_subscription(
  p_email TEXT,
  p_client_ip TEXT
)
RETURNS TABLE (out_token TEXT, out_purpose TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email TEXT := pg_catalog.lower(pg_catalog.btrim(p_email));
  v_subscriber_id UUID;
  v_is_active BOOLEAN;
  v_token TEXT;
  v_purpose TEXT;
  v_email_key BYTEA;
  v_ip_key BYTEA;
BEGIN
  IF v_email IS NULL
     OR pg_catalog.length(v_email) > 254
     OR v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' THEN
    RAISE EXCEPTION 'Adresse e-mail invalide' USING ERRCODE = '22023';
  END IF;

  v_email_key := extensions.digest(
    pg_catalog.convert_to('email:' || v_email, 'UTF8'),
    'sha256'
  );
  v_ip_key := extensions.digest(
    pg_catalog.convert_to('ip:' || COALESCE(p_client_ip, 'unknown'), 'UTF8'),
    'sha256'
  );

  IF NOT private.allow_newsletter_request(v_email_key, 3, INTERVAL '1 day')
     OR NOT private.allow_newsletter_request(v_ip_key, 10, INTERVAL '1 hour') THEN
    RAISE EXCEPTION 'Trop de demandes; réessayez plus tard' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM private.newsletter_unsubscribe_tokens
  WHERE expires_at < pg_catalog.now();

  INSERT INTO public.newsletter_subscribers (email, is_active)
  VALUES (v_email, FALSE)
  ON CONFLICT DO NOTHING;

  SELECT subscriber.id, subscriber.is_active
  INTO v_subscriber_id, v_is_active
  FROM public.newsletter_subscribers AS subscriber
  WHERE pg_catalog.lower(subscriber.email) = v_email
  FOR UPDATE;

  IF v_subscriber_id IS NULL THEN
    RAISE EXCEPTION 'Impossible de préparer la demande newsletter';
  END IF;

  v_purpose := CASE WHEN v_is_active THEN 'unsubscribe' ELSE 'confirm' END;

  DELETE FROM private.newsletter_unsubscribe_tokens
  WHERE subscriber_id = v_subscriber_id;

  v_token := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');

  INSERT INTO private.newsletter_unsubscribe_tokens (
    subscriber_id,
    token_hash,
    purpose,
    expires_at
  )
  VALUES (
    v_subscriber_id,
    extensions.digest(pg_catalog.convert_to(v_token, 'UTF8'), 'sha256'),
    v_purpose,
    pg_catalog.now() + INTERVAL '7 days'
  );

  RETURN QUERY SELECT v_token, v_purpose;
END;
$$;

REVOKE ALL ON FUNCTION public.request_newsletter_subscription(TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_newsletter_subscription(TEXT, TEXT)
  TO service_role;

CREATE OR REPLACE FUNCTION public.confirm_newsletter_subscription(p_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_subscriber_id UUID;
BEGIN
  IF p_token IS NULL OR pg_catalog.length(p_token) <> 64 THEN
    RETURN FALSE;
  END IF;

  UPDATE private.newsletter_unsubscribe_tokens AS token
  SET consumed_at = pg_catalog.now()
  WHERE token.token_hash =
      extensions.digest(pg_catalog.convert_to(p_token, 'UTF8'), 'sha256')
    AND token.purpose = 'confirm'
    AND token.consumed_at IS NULL
    AND token.expires_at > pg_catalog.now()
  RETURNING token.subscriber_id INTO v_subscriber_id;

  IF v_subscriber_id IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE public.newsletter_subscribers AS subscriber
  SET is_active = TRUE,
      unsubscribed_at = NULL
  WHERE subscriber.id = v_subscriber_id;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_newsletter_subscription(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_newsletter_subscription(TEXT)
  TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.unsubscribe_newsletter(p_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_subscriber_id UUID;
BEGIN
  IF p_token IS NULL OR pg_catalog.length(p_token) <> 64 THEN
    RETURN FALSE;
  END IF;

  UPDATE private.newsletter_unsubscribe_tokens AS token
  SET consumed_at = pg_catalog.now()
  WHERE token.token_hash =
      extensions.digest(pg_catalog.convert_to(p_token, 'UTF8'), 'sha256')
    AND token.purpose = 'unsubscribe'
    AND token.consumed_at IS NULL
    AND token.expires_at > pg_catalog.now()
  RETURNING token.subscriber_id INTO v_subscriber_id;

  IF v_subscriber_id IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE public.newsletter_subscribers AS subscriber
  SET is_active = FALSE,
      unsubscribed_at = pg_catalog.now()
  WHERE subscriber.id = v_subscriber_id
    AND subscriber.is_active;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.unsubscribe_newsletter(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unsubscribe_newsletter(TEXT)
  TO anon, authenticated, service_role;

-- Only authenticated owners/admins can read private listing images; public
-- listings remain available through signed URLs.
CREATE OR REPLACE FUNCTION public.can_view_property_object(p_object_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_admin() OR (
    (storage.foldername(p_object_name))[1] = 'properties'
    AND EXISTS (
      SELECT 1
      FROM public.properties AS property
      WHERE property.id::TEXT = (storage.foldername(p_object_name))[2]
        AND (
          property.owner_id = auth.uid()
          OR (property.is_published AND property.status = 'active')
        )
    )
  );
$$;

REVOKE ALL ON FUNCTION public.can_view_property_object(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_property_object(TEXT) TO anon, authenticated;

UPDATE storage.buckets
SET public = FALSE
WHERE id = 'property-images';

DROP POLICY IF EXISTS "property_images_public_select" ON storage.objects;
CREATE POLICY "property_images_public_select" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'property-images'
    AND public.can_view_property_object(name)
  );

DROP POLICY IF EXISTS "property_images_auth_insert" ON storage.objects;
CREATE POLICY "property_images_auth_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'property-images'
    AND public.can_manage_property_object(name)
  );

DROP POLICY IF EXISTS "property_images_auth_update" ON storage.objects;
CREATE POLICY "property_images_auth_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'property-images'
    AND public.can_manage_property_object(name)
  )
  WITH CHECK (
    bucket_id = 'property-images'
    AND public.can_manage_property_object(name)
  );

DROP POLICY IF EXISTS "property_images_auth_delete" ON storage.objects;
CREATE POLICY "property_images_auth_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'property-images'
    AND public.can_manage_property_object(name)
  );

DROP POLICY IF EXISTS "property_images_select_public" ON public.property_images;
CREATE POLICY "property_images_select_public" ON public.property_images
  FOR SELECT
  USING (
    property_id IN (
      SELECT id
      FROM public.properties
      WHERE is_published AND status = 'active'
    )
    OR property_id IN (
      SELECT id
      FROM public.properties
      WHERE owner_id = auth.uid()
    )
  );

-- Owners may edit listing content, but only admins can approve, publish, or
-- feature an announcement.
CREATE OR REPLACE FUNCTION public.protect_property_moderation_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR current_user IN ('postgres', 'service_role') OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.status := 'pending';
    NEW.is_published := FALSE;
    NEW.published_at := NULL;
    NEW.is_featured := FALSE;
  ELSIF ROW(NEW.status, NEW.is_published, NEW.published_at, NEW.is_featured)
        IS DISTINCT FROM
        ROW(OLD.status, OLD.is_published, OLD.published_at, OLD.is_featured) THEN
    RAISE EXCEPTION 'Seul un administrateur peut modifier la publication de l''annonce'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_property_moderation_fields ON public.properties;
CREATE TRIGGER protect_property_moderation_fields
  BEFORE INSERT OR UPDATE ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_property_moderation_fields();

DROP POLICY IF EXISTS "properties_update_own" ON public.properties;
CREATE POLICY "properties_update_own" ON public.properties
  FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "properties_insert_own" ON public.properties;
CREATE POLICY "properties_insert_own" ON public.properties
  FOR INSERT
  WITH CHECK (owner_id = auth.uid() AND auth.uid() IS NOT NULL);

-- Reputation fields are maintained by trusted admin workflows and database
-- triggers, never by an agency owner or self-registered agent.
CREATE OR REPLACE FUNCTION public.protect_agency_trust_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR current_user IN ('postgres', 'service_role') OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.is_verified := FALSE;
    NEW.rating_avg := 0;
    NEW.rating_count := 0;
    NEW.properties_count := 0;
  ELSIF ROW(NEW.is_verified, NEW.rating_avg, NEW.rating_count, NEW.properties_count)
        IS DISTINCT FROM
        ROW(OLD.is_verified, OLD.rating_avg, OLD.rating_count, OLD.properties_count) THEN
    RAISE EXCEPTION 'Les champs de vérification et de réputation sont réservés à l''administration'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_agent_trust_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR current_user IN ('postgres', 'service_role') OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.is_verified := FALSE;
    NEW.rating_avg := 0;
    NEW.rating_count := 0;
    NEW.properties_count := 0;
    NEW.sales_count := 0;
  ELSE
    IF NEW.profile_id IS DISTINCT FROM OLD.profile_id THEN
      RAISE EXCEPTION 'L''identité de l''agent ne peut pas être modifiée'
        USING ERRCODE = '42501';
    END IF;
    IF ROW(NEW.is_verified, NEW.rating_avg, NEW.rating_count, NEW.properties_count, NEW.sales_count)
       IS DISTINCT FROM
       ROW(OLD.is_verified, OLD.rating_avg, OLD.rating_count, OLD.properties_count, OLD.sales_count) THEN
      RAISE EXCEPTION 'Les champs de vérification et de réputation sont réservés à l''administration'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.agency_id IS NOT NULL
     AND (
       TG_OP = 'INSERT'
       OR NEW.agency_id IS DISTINCT FROM OLD.agency_id
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.agencies
       WHERE id = NEW.agency_id AND owner_id = auth.uid()
     ) THEN
    RAISE EXCEPTION 'Seul le propriétaire de l''agence peut rattacher un agent à celle-ci'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_agency_trust_fields ON public.agencies;
CREATE TRIGGER protect_agency_trust_fields
  BEFORE INSERT OR UPDATE ON public.agencies
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_agency_trust_fields();

DROP TRIGGER IF EXISTS protect_agent_trust_fields ON public.agents;
CREATE TRIGGER protect_agent_trust_fields
  BEFORE INSERT OR UPDATE ON public.agents
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_agent_trust_fields();

DROP POLICY IF EXISTS "agencies_update_own" ON public.agencies;
CREATE POLICY "agencies_update_own" ON public.agencies
  FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "agents_update_own" ON public.agents;
CREATE POLICY "agents_update_own" ON public.agents
  FOR UPDATE
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "agents_update_agency_owner" ON public.agents;
CREATE POLICY "agents_update_agency_owner" ON public.agents
  FOR UPDATE
  USING (
    agency_id IN (SELECT id FROM public.agencies WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    agency_id IN (SELECT id FROM public.agencies WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "agencies_update_admin" ON public.agencies;
CREATE POLICY "agencies_update_admin" ON public.agencies
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "agents_update_admin" ON public.agents;
CREATE POLICY "agents_update_admin" ON public.agents
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Appointment participants may update only the status, with transitions
-- constrained by their role. Rescheduling and reassignment are admin-only.
CREATE OR REPLACE FUNCTION public.protect_appointment_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_is_agent BOOLEAN;
BEGIN
  IF auth.uid() IS NULL OR current_user IN ('postgres', 'service_role') OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF ROW(
       NEW.id, NEW.property_id, NEW.user_id, NEW.agent_id, NEW.scheduled_at,
       NEW.duration_minutes, NEW.notes, NEW.contact_phone, NEW.contact_name,
       NEW.created_at
     ) IS DISTINCT FROM ROW(
       OLD.id, OLD.property_id, OLD.user_id, OLD.agent_id, OLD.scheduled_at,
       OLD.duration_minutes, OLD.notes, OLD.contact_phone, OLD.contact_name,
       OLD.created_at
     ) THEN
    RAISE EXCEPTION 'Les participants ne peuvent pas modifier les détails du rendez-vous'
      USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.agents AS agent
    WHERE agent.id = OLD.agent_id AND agent.profile_id = auth.uid()
  ) INTO v_is_agent;

  IF OLD.user_id = auth.uid() THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NOT (
         OLD.status IN ('pending', 'confirmed')
         AND NEW.status = 'cancelled'
       ) THEN
      RAISE EXCEPTION 'Transition de statut non autorisée pour le demandeur'
        USING ERRCODE = '42501';
    END IF;
  ELSIF v_is_agent THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NOT (
         (OLD.status = 'pending' AND NEW.status IN ('confirmed', 'cancelled'))
         OR (OLD.status = 'confirmed' AND NEW.status IN ('completed', 'cancelled'))
       ) THEN
      RAISE EXCEPTION 'Transition de statut non autorisée pour cet agent'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    RAISE EXCEPTION 'Modification du rendez-vous non autorisée'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_appointment_updates ON public.appointments;
CREATE TRIGGER protect_appointment_updates
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_appointment_updates();

DROP POLICY IF EXISTS "appointments_update_own" ON public.appointments;
CREATE POLICY "appointments_update_own" ON public.appointments
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "appointments_update_agent" ON public.appointments;
CREATE POLICY "appointments_update_agent" ON public.appointments
  FOR UPDATE
  USING (
    agent_id IN (SELECT id FROM public.agents WHERE profile_id = auth.uid())
  )
  WITH CHECK (
    agent_id IN (SELECT id FROM public.agents WHERE profile_id = auth.uid())
  );

-- Client-submitted activity rows are not authoritative audit records. Only
-- trusted server roles may insert them.
DROP POLICY IF EXISTS "activity_logs_insert_system" ON public.activity_logs;

-- Harden pre-existing SECURITY DEFINER functions with an empty search_path
-- and schema-qualified object references.
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.user_role
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT profile.role
  FROM public.profiles AS profile
  WHERE profile.id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(public.get_user_role() IN ('super_admin', 'admin'), FALSE);
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(public.get_user_role() = 'super_admin', FALSE);
$$;

CREATE OR REPLACE FUNCTION public.is_conversation_participant(conv_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants AS participant
    WHERE participant.conversation_id = conv_id
      AND participant.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_property_object(object_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT public.is_admin() OR (
    (storage.foldername(object_name))[1] = 'properties'
    AND EXISTS (
      SELECT 1
      FROM public.properties AS property
      WHERE property.id::TEXT = (storage.foldername(object_name))[2]
        AND property.owner_id = auth.uid()
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  requested_role TEXT := NEW.raw_user_meta_data->>'role';
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, phone, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    CASE
      WHEN requested_role IN ('client', 'owner') THEN requested_role::public.user_role
      ELSE 'client'::public.user_role
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Modification du rôle non autorisée' USING ERRCODE = '42501';
    END IF;
    IF (NEW.role IN ('admin', 'super_admin') OR OLD.role IN ('admin', 'super_admin'))
       AND NOT public.is_super_admin() THEN
      RAISE EXCEPTION 'Seul un super_admin peut gérer les rôles administrateur'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF (NEW.is_verified IS DISTINCT FROM OLD.is_verified
      OR NEW.is_active IS DISTINCT FROM OLD.is_active)
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Modification du statut du compte non autorisée' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_property_views(property_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.properties AS property
  SET views_count = property.views_count + 1
  WHERE property.id = $1
    AND property.is_published
    AND property.status = 'active';
END;
$$;

CREATE OR REPLACE FUNCTION public.update_property_favorites_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.properties
    SET favorites_count = favorites_count + 1
    WHERE id = NEW.property_id;
    RETURN NEW;
  END IF;

  UPDATE public.properties
  SET favorites_count = favorites_count - 1
  WHERE id = OLD.property_id;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_agency_properties_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.agency_id IS NOT NULL
     AND (TG_OP = 'DELETE' OR OLD.agency_id IS DISTINCT FROM NEW.agency_id) THEN
    UPDATE public.agencies
    SET properties_count = properties_count - 1
    WHERE id = OLD.agency_id;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.agency_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.agency_id IS DISTINCT FROM NEW.agency_id) THEN
    UPDATE public.agencies
    SET properties_count = properties_count + 1
    WHERE id = NEW.agency_id;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_agent_properties_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.agent_id IS NOT NULL
     AND (TG_OP = 'DELETE' OR OLD.agent_id IS DISTINCT FROM NEW.agent_id) THEN
    UPDATE public.agents
    SET properties_count = properties_count - 1
    WHERE id = OLD.agent_id;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.agent_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.agent_id IS DISTINCT FROM NEW.agent_id) THEN
    UPDATE public.agents
    SET properties_count = properties_count + 1
    WHERE id = NEW.agent_id;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_conversation_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.conversations
  SET updated_at = pg_catalog.now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_review_aggregate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_avg_rating DOUBLE PRECISION;
  v_total_reviews INTEGER;
  v_target_id UUID;
  v_target_type public.review_target_type;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    v_target_id := OLD.target_id;
    v_target_type := OLD.target_type;
    SELECT AVG(review.rating)::DOUBLE PRECISION, COUNT(*)
    INTO v_avg_rating, v_total_reviews
    FROM public.reviews AS review
    WHERE review.target_id = v_target_id
      AND review.target_type = v_target_type
      AND review.is_published;

    IF v_target_type = 'agent' THEN
      UPDATE public.agents
      SET rating_avg = COALESCE(v_avg_rating, 0),
          rating_count = COALESCE(v_total_reviews, 0)
      WHERE id = v_target_id;
    ELSE
      UPDATE public.agencies
      SET rating_avg = COALESCE(v_avg_rating, 0),
          rating_count = COALESCE(v_total_reviews, 0)
      WHERE id = v_target_id;
    END IF;
  END IF;

  IF TG_OP <> 'DELETE' THEN
    v_target_id := NEW.target_id;
    v_target_type := NEW.target_type;
    SELECT AVG(review.rating)::DOUBLE PRECISION, COUNT(*)
    INTO v_avg_rating, v_total_reviews
    FROM public.reviews AS review
    WHERE review.target_id = v_target_id
      AND review.target_type = v_target_type
      AND review.is_published;

    IF v_target_type = 'agent' THEN
      UPDATE public.agents
      SET rating_avg = COALESCE(v_avg_rating, 0),
          rating_count = COALESCE(v_total_reviews, 0)
      WHERE id = v_target_id;
    ELSE
      UPDATE public.agencies
      SET rating_avg = COALESCE(v_avg_rating, 0),
          rating_count = COALESCE(v_total_reviews, 0)
      WHERE id = v_target_id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.start_conversation(
  p_recipient_id UUID,
  p_property_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_conversation_id UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Authentification requise' USING ERRCODE = '42501';
  END IF;

  IF p_recipient_id IS NULL OR p_recipient_id = v_caller THEN
    RAISE EXCEPTION 'Destinataire invalide' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_recipient_id AND is_active
  ) THEN
    RAISE EXCEPTION 'Destinataire introuvable' USING ERRCODE = 'P0002';
  END IF;

  IF p_property_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.properties
    WHERE id = p_property_id
      AND ((is_published AND status = 'active') OR owner_id = v_caller)
  ) THEN
    RAISE EXCEPTION 'Annonce introuvable' USING ERRCODE = 'P0002';
  END IF;

  SELECT conversation.id INTO v_conversation_id
  FROM public.conversations AS conversation
  JOIN public.conversation_participants AS caller_participant
    ON caller_participant.conversation_id = conversation.id
   AND caller_participant.user_id = v_caller
  JOIN public.conversation_participants AS other_participant
    ON other_participant.conversation_id = conversation.id
   AND other_participant.user_id = p_recipient_id
  WHERE conversation.property_id IS NOT DISTINCT FROM p_property_id
  ORDER BY conversation.updated_at DESC
  LIMIT 1;

  IF v_conversation_id IS NOT NULL THEN
    RETURN v_conversation_id;
  END IF;

  INSERT INTO public.conversations (property_id)
  VALUES (p_property_id)
  RETURNING id INTO v_conversation_id;

  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (v_conversation_id, v_caller), (v_conversation_id, p_recipient_id);

  RETURN v_conversation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_conversation_read(p_conversation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_conversation_participant(p_conversation_id) THEN
    RAISE EXCEPTION 'Conversation introuvable' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.messages
  SET status = 'read'
  WHERE conversation_id = p_conversation_id
    AND sender_id <> auth.uid()
    AND status <> 'read';
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_conversation_participant(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_property_object(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_conversation_participant(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_property_object(TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_profile_privileged_columns()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_property_favorites_count()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_agency_properties_count()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_agent_properties_count()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_conversation_on_message()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_review_aggregate()
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.increment_property_views(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_property_views(UUID) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.start_conversation(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_conversation_read(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_conversation(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(UUID) TO authenticated;

COMMIT;
