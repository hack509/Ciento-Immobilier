-- =====================================================
-- Ciento-Immobilier: Marketplace core (phase 3)
-- =====================================================
-- Additive migration. Existing tables, policies and data are preserved.
--   * Listing columns for availability and paid visibility
--   * Agency team (agency_members) with per-member permissions
--   * Agency portfolio access for members (RLS + storage)
--   * Visitor inquiries (property_inquiries) with rate-limited RPC
--   * Daily listing statistics (property_daily_stats)
-- Rollback: supabase/rollbacks/016_marketplace_core.down.sql

BEGIN;

-- =====================================================
-- 1. Settings helpers (site_settings is super_admin-only via RLS)
-- =====================================================
CREATE OR REPLACE FUNCTION public.setting_int(p_key TEXT, p_default INTEGER)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT CASE WHEN jsonb_typeof(s.value) = 'number' THEN (s.value #>> '{}')::INTEGER END
     FROM public.site_settings AS s WHERE s.key = p_key),
    p_default
  );
$$;

CREATE OR REPLACE FUNCTION public.setting_bool(p_key TEXT, p_default BOOLEAN)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT CASE WHEN jsonb_typeof(s.value) = 'boolean' THEN (s.value #>> '{}')::BOOLEAN END
     FROM public.site_settings AS s WHERE s.key = p_key),
    p_default
  );
$$;

REVOKE ALL ON FUNCTION public.setting_int(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.setting_bool(TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;

-- Admins (not only super_admin) may read settings; writes stay super_admin-only.
DROP POLICY IF EXISTS "site_settings_select_admin" ON public.site_settings;
CREATE POLICY "site_settings_select_admin" ON public.site_settings
  FOR SELECT USING (public.is_admin());

INSERT INTO public.site_settings (key, value, description) VALUES
  ('free_owner_listing_limit', '3', 'Annonces actives ou en attente autorisées sans abonnement (particulier)'),
  ('free_agency_listing_limit', '5', 'Annonces actives ou en attente autorisées pour une agence sans abonnement'),
  ('payments_simulation_enabled', 'false', 'Paiements simulés (DÉVELOPPEMENT UNIQUEMENT — doit rester false en production)'),
  ('payment_checkout_ttl_minutes', '120', 'Durée de validité d''une transaction en attente (minutes)'),
  ('inquiry_rate_limit_per_hour', '5', 'Demandes de contact maximum par e-mail et par heure')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- 2. Listing columns
-- =====================================================
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS available_from DATE,
  ADD COLUMN IF NOT EXISTS sponsored_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS premium_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS premium_details JSONB NOT NULL DEFAULT '{}'::JSONB;

COMMENT ON COLUMN public.properties.sponsored_until IS 'Fin de la promotion sponsorisée en cours (maintenu par le serveur)';
COMMENT ON COLUMN public.properties.premium_until IS 'Fin de l''option Premium en cours (maintenu par le serveur)';
COMMENT ON COLUMN public.properties.premium_details IS 'Informations supplémentaires affichées pour une annonce Premium';

CREATE INDEX IF NOT EXISTS idx_properties_public_ranking
  ON public.properties (sponsored_until DESC NULLS LAST, premium_until DESC NULLS LAST, created_at DESC)
  WHERE is_published AND status = 'active';
CREATE INDEX IF NOT EXISTS idx_properties_building_area ON public.properties (building_area);
CREATE INDEX IF NOT EXISTS idx_properties_available_from ON public.properties (available_from);

-- Paid visibility and counters are written only by trusted server code.
CREATE OR REPLACE FUNCTION public.protect_property_server_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR current_user IN ('postgres', 'service_role', 'supabase_admin') OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.sponsored_until := NULL;
    NEW.premium_until := NULL;
    NEW.views_count := 0;
    NEW.favorites_count := 0;
    NEW.inquiries_count := 0;
    RETURN NEW;
  END IF;

  IF ROW(NEW.sponsored_until, NEW.premium_until, NEW.views_count, NEW.favorites_count, NEW.inquiries_count)
     IS DISTINCT FROM
     ROW(OLD.sponsored_until, OLD.premium_until, OLD.views_count, OLD.favorites_count, OLD.inquiries_count) THEN
    RAISE EXCEPTION 'Ces champs sont gérés par la plateforme' USING ERRCODE = '42501';
  END IF;

  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'Le propriétaire d''une annonce ne peut pas être modifié' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_property_server_fields ON public.properties;
CREATE TRIGGER protect_property_server_fields
  BEFORE INSERT OR UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.protect_property_server_fields();

-- =====================================================
-- 3. Agencies: presentation fields + one agency per owner
-- =====================================================
ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS tagline TEXT,
  ADD COLUMN IF NOT EXISTS brand_color TEXT,
  ADD COLUMN IF NOT EXISTS team_intro TEXT,
  ADD COLUMN IF NOT EXISTS verification_requested_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agencies_brand_color_hex') THEN
    ALTER TABLE public.agencies
      ADD CONSTRAINT agencies_brand_color_hex CHECK (brand_color IS NULL OR brand_color ~ '^#[0-9A-Fa-f]{6}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agencies_website_http') THEN
    ALTER TABLE public.agencies
      ADD CONSTRAINT agencies_website_http CHECK (website IS NULL OR website ~* '^https?://') NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agencies_slug_format') THEN
    ALTER TABLE public.agencies
      ADD CONSTRAINT agencies_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$') NOT VALID;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.limit_agencies_per_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.is_admin() OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.agencies WHERE owner_id = NEW.owner_id) THEN
    RAISE EXCEPTION 'Vous gérez déjà une agence' USING ERRCODE = '23505';
  END IF;
  -- New agencies always start unverified and wait for an administrator.
  NEW.is_verified := FALSE;
  NEW.verification_requested_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS limit_agencies_per_owner ON public.agencies;
CREATE TRIGGER limit_agencies_per_owner
  BEFORE INSERT ON public.agencies
  FOR EACH ROW EXECUTE FUNCTION public.limit_agencies_per_owner();

REVOKE ALL ON FUNCTION public.limit_agencies_per_owner() FROM PUBLIC, anon, authenticated;

-- =====================================================
-- 4. Agency members (team & permissions)
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agency_member_role') THEN
    CREATE TYPE public.agency_member_role AS ENUM ('manager', 'agent');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.agency_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  member_role public.agency_member_role NOT NULL DEFAULT 'agent',
  title TEXT CHECK (title IS NULL OR char_length(title) <= 80),
  can_publish BOOLEAN NOT NULL DEFAULT TRUE,
  can_manage_leads BOOLEAN NOT NULL DEFAULT TRUE,
  can_manage_billing BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agency_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_agency_members_profile ON public.agency_members (profile_id) WHERE is_active;

DROP TRIGGER IF EXISTS update_agency_members_updated_at ON public.agency_members;
CREATE TRIGGER update_agency_members_updated_at
  BEFORE UPDATE ON public.agency_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.agency_members ENABLE ROW LEVEL SECURITY;

-- Permission helpers --------------------------------------------------------
-- Owner of the agency = full rights. Active manager = full rights except
-- promoting other managers. Active agent = rights given by its flags.
CREATE OR REPLACE FUNCTION public.is_agency_owner(p_agency_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.agencies AS a
    WHERE a.id = p_agency_id AND a.owner_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_agency_member(p_agency_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT public.is_agency_owner(p_agency_id) OR EXISTS (
    SELECT 1 FROM public.agency_members AS m
    WHERE m.agency_id = p_agency_id AND m.profile_id = auth.uid() AND m.is_active
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_agency(p_agency_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT public.is_agency_owner(p_agency_id) OR EXISTS (
    SELECT 1 FROM public.agency_members AS m
    WHERE m.agency_id = p_agency_id AND m.profile_id = auth.uid()
      AND m.is_active AND m.member_role = 'manager'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_agency_permission(p_agency_id UUID, p_permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT p_agency_id IS NOT NULL AND (
    public.can_manage_agency(p_agency_id) OR EXISTS (
      SELECT 1 FROM public.agency_members AS m
      WHERE m.agency_id = p_agency_id AND m.profile_id = auth.uid() AND m.is_active
        AND CASE p_permission
              WHEN 'publish' THEN m.can_publish
              WHEN 'leads' THEN m.can_manage_leads
              WHEN 'billing' THEN m.can_manage_billing
              ELSE FALSE
            END
    )
  );
$$;

REVOKE ALL ON FUNCTION public.is_agency_owner(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_agency_member(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_agency(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_agency_permission(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_agency_owner(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_agency_member(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_agency(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_agency_permission(UUID, TEXT) TO anon, authenticated;

-- RLS: members see their own row; managers see the team; admins see all.
DROP POLICY IF EXISTS "agency_members_select" ON public.agency_members;
CREATE POLICY "agency_members_select" ON public.agency_members
  FOR SELECT USING (
    profile_id = auth.uid() OR public.is_agency_member(agency_id) OR public.is_admin()
  );

DROP POLICY IF EXISTS "agency_members_update_manager" ON public.agency_members;
CREATE POLICY "agency_members_update_manager" ON public.agency_members
  FOR UPDATE USING (public.can_manage_agency(agency_id) OR public.is_admin())
  WITH CHECK (public.can_manage_agency(agency_id) OR public.is_admin());

DROP POLICY IF EXISTS "agency_members_delete_manager" ON public.agency_members;
CREATE POLICY "agency_members_delete_manager" ON public.agency_members
  FOR DELETE USING (
    public.can_manage_agency(agency_id) OR public.is_admin() OR profile_id = auth.uid()
  );
-- No INSERT policy: members are added through add_agency_member().

CREATE OR REPLACE FUNCTION public.protect_agency_member_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR current_user IN ('postgres', 'service_role', 'supabase_admin') OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF NEW.agency_id IS DISTINCT FROM OLD.agency_id OR NEW.profile_id IS DISTINCT FROM OLD.profile_id THEN
    RAISE EXCEPTION 'Membre non modifiable' USING ERRCODE = '42501';
  END IF;
  IF (NEW.member_role IS DISTINCT FROM OLD.member_role OR NEW.can_manage_billing IS DISTINCT FROM OLD.can_manage_billing)
     AND NOT public.is_agency_owner(NEW.agency_id) THEN
    RAISE EXCEPTION 'Seul le titulaire de l''agence peut modifier ce rôle' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_agency_member_fields ON public.agency_members;
CREATE TRIGGER protect_agency_member_fields
  BEFORE UPDATE ON public.agency_members
  FOR EACH ROW EXECUTE FUNCTION public.protect_agency_member_fields();

-- Public team presentation (no e-mail / phone of members).
CREATE OR REPLACE VIEW public.public_agency_team
WITH (security_barrier = true, security_invoker = false)
AS
SELECT m.id, m.agency_id, m.profile_id, m.member_role, m.title,
       p.first_name, p.last_name, p.avatar_url, p.bio
FROM public.agency_members AS m
JOIN public.profiles AS p ON p.id = m.profile_id
JOIN public.agencies AS a ON a.id = m.agency_id
WHERE m.is_active AND p.is_active AND a.is_active;

REVOKE ALL ON public.public_agency_team FROM PUBLIC;
GRANT SELECT ON public.public_agency_team TO anon, authenticated;

-- =====================================================
-- 5. Agency portfolio access on properties
-- =====================================================
DROP POLICY IF EXISTS "properties_select_agency" ON public.properties;
CREATE POLICY "properties_select_agency" ON public.properties
  FOR SELECT USING (agency_id IS NOT NULL AND public.is_agency_member(agency_id));

DROP POLICY IF EXISTS "properties_update_agency" ON public.properties;
CREATE POLICY "properties_update_agency" ON public.properties
  FOR UPDATE USING (public.has_agency_permission(agency_id, 'publish'))
  WITH CHECK (public.has_agency_permission(agency_id, 'publish'));

DROP POLICY IF EXISTS "properties_delete_agency" ON public.properties;
CREATE POLICY "properties_delete_agency" ON public.properties
  FOR DELETE USING (agency_id IS NOT NULL AND public.can_manage_agency(agency_id));

-- An agency listing belongs to the agency: its author keeps write access only
-- while still allowed to publish for that agency (removed / restricted agents
-- lose it). Personal listings (agency_id IS NULL) are unchanged.
DROP POLICY IF EXISTS "properties_update_own" ON public.properties;
CREATE POLICY "properties_update_own" ON public.properties
  FOR UPDATE
  USING (owner_id = auth.uid() AND (agency_id IS NULL OR public.has_agency_permission(agency_id, 'publish')))
  WITH CHECK (owner_id = auth.uid() AND (agency_id IS NULL OR public.has_agency_permission(agency_id, 'publish')));

DROP POLICY IF EXISTS "properties_delete_own" ON public.properties;
CREATE POLICY "properties_delete_own" ON public.properties
  FOR DELETE USING (owner_id = auth.uid() AND (agency_id IS NULL OR public.has_agency_permission(agency_id, 'publish')));

DROP POLICY IF EXISTS "property_images_insert_own" ON public.property_images;
CREATE POLICY "property_images_insert_own" ON public.property_images
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.properties AS p WHERE p.id = property_id AND p.owner_id = auth.uid() AND p.agency_id IS NULL));
DROP POLICY IF EXISTS "property_images_update_own" ON public.property_images;
CREATE POLICY "property_images_update_own" ON public.property_images
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.properties AS p WHERE p.id = property_id AND p.owner_id = auth.uid() AND p.agency_id IS NULL));
DROP POLICY IF EXISTS "property_images_delete_own" ON public.property_images;
CREATE POLICY "property_images_delete_own" ON public.property_images
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.properties AS p WHERE p.id = property_id AND p.owner_id = auth.uid() AND p.agency_id IS NULL));

-- A listing may only be attached to an agency (or agent) the author belongs to.
-- Closes a gap where any user could attach a listing to another agency.
CREATE OR REPLACE FUNCTION public.validate_property_affiliation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.agency_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.agency_id IS DISTINCT FROM OLD.agency_id)
     AND NOT public.has_agency_permission(NEW.agency_id, 'publish') THEN
    RAISE EXCEPTION 'Vous n''êtes pas autorisé à publier pour cette agence' USING ERRCODE = '42501';
  END IF;

  IF NEW.agent_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.agent_id IS DISTINCT FROM OLD.agent_id)
     AND NOT EXISTS (
       SELECT 1 FROM public.agents AS ag
       WHERE ag.id = NEW.agent_id
         AND (ag.profile_id = auth.uid()
              OR (ag.agency_id IS NOT NULL AND ag.agency_id = NEW.agency_id
                  AND public.can_manage_agency(ag.agency_id)))
     ) THEN
    RAISE EXCEPTION 'Agent non autorisé pour cette annonce' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_property_affiliation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS validate_property_affiliation ON public.properties;
CREATE TRIGGER validate_property_affiliation
  BEFORE INSERT OR UPDATE OF agency_id, agent_id ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.validate_property_affiliation();

-- Images of agency listings can be managed by members with publish rights.
DROP POLICY IF EXISTS "property_images_manage_agency" ON public.property_images;
CREATE POLICY "property_images_manage_agency" ON public.property_images
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.properties AS p
            WHERE p.id = property_id AND public.has_agency_permission(p.agency_id, 'publish'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.properties AS p
            WHERE p.id = property_id AND public.has_agency_permission(p.agency_id, 'publish'))
  );

DROP POLICY IF EXISTS "property_amenities_manage_agency" ON public.property_amenities;
CREATE POLICY "property_amenities_manage_agency" ON public.property_amenities
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.properties AS p
            WHERE p.id = property_id AND public.has_agency_permission(p.agency_id, 'publish'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.properties AS p
            WHERE p.id = property_id AND public.has_agency_permission(p.agency_id, 'publish'))
  );

-- Storage: same owner rule as before, extended to agency publishers.
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
        AND ((property.owner_id = auth.uid() AND property.agency_id IS NULL)
             OR public.has_agency_permission(property.agency_id, 'publish'))
    )
  );
$$;

-- =====================================================
-- 6. Add a member by e-mail (agency managers only)
-- =====================================================
-- Seat limit placeholder; replaced in 017 once subscriptions exist.
CREATE OR REPLACE FUNCTION public.agency_member_limit(p_agency_id UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$ SELECT 1; $$;

REVOKE ALL ON FUNCTION public.agency_member_limit(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.add_agency_member(
  p_agency_id UUID,
  p_email TEXT,
  p_role public.agency_member_role DEFAULT 'agent',
  p_title TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile_id UUID;
  v_member_id UUID;
  v_max_members INTEGER;
  v_current INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise' USING ERRCODE = '42501';
  END IF;
  IF NOT (public.can_manage_agency(p_agency_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;
  IF p_role = 'manager' AND NOT (public.is_agency_owner(p_agency_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'Seul le titulaire peut nommer un gestionnaire' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE lower(email) = lower(trim(p_email)) AND is_active;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Aucun compte actif avec cette adresse. L''agent doit d''abord créer son compte.'
      USING ERRCODE = 'P0002';
  END IF;

  -- Seat limit from the agency subscription (defined in 017; NULL = unlimited).
  v_max_members := public.agency_member_limit(p_agency_id);
  SELECT count(*) INTO v_current FROM public.agency_members WHERE agency_id = p_agency_id AND is_active;
  IF v_max_members IS NOT NULL AND v_current >= v_max_members THEN
    RAISE EXCEPTION 'Limite de membres atteinte pour votre formule (%).', v_max_members USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.agency_members (agency_id, profile_id, member_role, title, invited_by)
  VALUES (p_agency_id, v_profile_id, p_role, NULLIF(trim(p_title), ''), auth.uid())
  ON CONFLICT (agency_id, profile_id)
  DO UPDATE SET is_active = TRUE, member_role = EXCLUDED.member_role, title = EXCLUDED.title
  RETURNING id INTO v_member_id;

  INSERT INTO public.notifications (user_id, type, title, message, link)
  SELECT v_profile_id, 'system', 'Ajout à une agence',
         format('Vous avez été ajouté à l''équipe de l''agence « %s ».', a.name), '/dashboard/agence'
  FROM public.agencies AS a WHERE a.id = p_agency_id;

  RETURN v_member_id;
END;
$$;

REVOKE ALL ON FUNCTION public.add_agency_member(UUID, TEXT, public.agency_member_role, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_agency_member(UUID, TEXT, public.agency_member_role, TEXT) TO authenticated;

-- =====================================================
-- 7. Visitor inquiries (leads)
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inquiry_status') THEN
    CREATE TYPE public.inquiry_status AS ENUM ('new', 'contacted', 'qualified', 'closed', 'spam');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.property_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  agency_id UUID REFERENCES public.agencies(id) ON DELETE SET NULL,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 120),
  email TEXT NOT NULL CHECK (char_length(email) <= 254 AND email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
  phone TEXT CHECK (phone IS NULL OR char_length(phone) <= 30),
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 10 AND 2000),
  status public.inquiry_status NOT NULL DEFAULT 'new',
  notes TEXT CHECK (notes IS NULL OR char_length(notes) <= 2000),
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inquiries_recipient ON public.property_inquiries (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inquiries_agency ON public.property_inquiries (agency_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inquiries_property ON public.property_inquiries (property_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_email_recent ON public.property_inquiries (lower(email), created_at DESC);

DROP TRIGGER IF EXISTS update_property_inquiries_updated_at ON public.property_inquiries;
CREATE TRIGGER update_property_inquiries_updated_at
  BEFORE UPDATE ON public.property_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.property_inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inquiries_select" ON public.property_inquiries;
CREATE POLICY "inquiries_select" ON public.property_inquiries
  FOR SELECT USING (
    recipient_id = auth.uid()
    OR sender_id = auth.uid()
    OR public.has_agency_permission(agency_id, 'leads')
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "inquiries_update_recipient" ON public.property_inquiries;
CREATE POLICY "inquiries_update_recipient" ON public.property_inquiries
  FOR UPDATE USING (
    recipient_id = auth.uid() OR public.has_agency_permission(agency_id, 'leads') OR public.is_admin()
  ) WITH CHECK (
    recipient_id = auth.uid() OR public.has_agency_permission(agency_id, 'leads') OR public.is_admin()
  );
-- No INSERT / DELETE policies: inquiries are created by submit_property_inquiry().

-- Only workflow fields can be edited by recipients.
CREATE OR REPLACE FUNCTION public.protect_inquiry_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR current_user IN ('postgres', 'service_role', 'supabase_admin') THEN
    RETURN NEW;
  END IF;
  IF ROW(NEW.property_id, NEW.recipient_id, NEW.agency_id, NEW.sender_id, NEW.full_name, NEW.email, NEW.phone, NEW.message, NEW.created_at)
     IS DISTINCT FROM
     ROW(OLD.property_id, OLD.recipient_id, OLD.agency_id, OLD.sender_id, OLD.full_name, OLD.email, OLD.phone, OLD.message, OLD.created_at) THEN
    RAISE EXCEPTION 'Seuls le statut, les notes et l''assignation sont modifiables' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_inquiry_fields ON public.property_inquiries;
CREATE TRIGGER protect_inquiry_fields
  BEFORE UPDATE ON public.property_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.protect_inquiry_fields();

-- =====================================================
-- 8. Daily statistics
-- =====================================================
CREATE TABLE IF NOT EXISTS public.property_daily_stats (
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  inquiries INTEGER NOT NULL DEFAULT 0,
  favorites INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (property_id, day)
);

ALTER TABLE public.property_daily_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "property_daily_stats_select" ON public.property_daily_stats;
CREATE POLICY "property_daily_stats_select" ON public.property_daily_stats
  FOR SELECT USING (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.properties AS p
      WHERE p.id = property_id
        AND (p.owner_id = auth.uid() OR (p.agency_id IS NOT NULL AND public.is_agency_member(p.agency_id)))
    )
  );

CREATE OR REPLACE FUNCTION public.bump_property_daily_stat(p_property_id UUID, p_metric TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.property_daily_stats (property_id, day, views, inquiries, favorites)
  VALUES (p_property_id, CURRENT_DATE,
          (p_metric = 'views')::INTEGER, (p_metric = 'inquiries')::INTEGER, (p_metric = 'favorites')::INTEGER)
  ON CONFLICT (property_id, day) DO UPDATE SET
    views = public.property_daily_stats.views + (p_metric = 'views')::INTEGER,
    inquiries = public.property_daily_stats.inquiries + (p_metric = 'inquiries')::INTEGER,
    favorites = public.property_daily_stats.favorites + (p_metric = 'favorites')::INTEGER;
END;
$$;

REVOKE ALL ON FUNCTION public.bump_property_daily_stat(UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- Same contract as before (014) + daily statistics.
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

  IF FOUND THEN
    PERFORM public.bump_property_daily_stat($1, 'views');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.track_favorite_daily_stat()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.bump_property_daily_stat(NEW.property_id, 'favorites');
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.track_favorite_daily_stat() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS track_favorite_daily_stat ON public.favorites;
CREATE TRIGGER track_favorite_daily_stat
  AFTER INSERT ON public.favorites
  FOR EACH ROW EXECUTE FUNCTION public.track_favorite_daily_stat();

-- =====================================================
-- 9. Submit an inquiry (visitors, rate limited)
-- =====================================================
CREATE OR REPLACE FUNCTION public.submit_property_inquiry(
  p_property_id UUID,
  p_full_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_message TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_property public.properties%ROWTYPE;
  v_recipient UUID;
  v_email TEXT := lower(trim(p_email));
  v_recent INTEGER;
  v_id UUID;
BEGIN
  SELECT * INTO v_property FROM public.properties
  WHERE id = p_property_id AND is_published AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Annonce indisponible' USING ERRCODE = 'P0002';
  END IF;

  IF v_property.owner_id = auth.uid() THEN
    RAISE EXCEPTION 'Vous ne pouvez pas contacter votre propre annonce' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO v_recent
  FROM public.property_inquiries
  WHERE (lower(email) = v_email OR (auth.uid() IS NOT NULL AND sender_id = auth.uid()))
    AND created_at > NOW() - INTERVAL '1 hour';
  IF v_recent >= public.setting_int('inquiry_rate_limit_per_hour', 5) THEN
    RAISE EXCEPTION 'Trop de demandes. Réessayez plus tard.' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.property_inquiries
    WHERE property_id = p_property_id AND lower(email) = v_email
      AND created_at > NOW() - INTERVAL '10 minutes'
  ) THEN
    RAISE EXCEPTION 'Votre demande a déjà été envoyée.' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(
    (SELECT ag.profile_id FROM public.agents AS ag WHERE ag.id = v_property.agent_id AND ag.is_active),
    v_property.owner_id
  ) INTO v_recipient;

  INSERT INTO public.property_inquiries (property_id, recipient_id, agency_id, sender_id, full_name, email, phone, message)
  VALUES (p_property_id, v_recipient, v_property.agency_id, auth.uid(),
          trim(p_full_name), v_email, NULLIF(trim(p_phone), ''), trim(p_message))
  RETURNING id INTO v_id;

  UPDATE public.properties SET inquiries_count = inquiries_count + 1 WHERE id = p_property_id;
  PERFORM public.bump_property_daily_stat(p_property_id, 'inquiries');

  INSERT INTO public.notifications (user_id, type, title, message, link)
  VALUES (v_recipient, 'message', 'Nouvelle demande de contact',
          format('%s s''intéresse à « %s ».', trim(p_full_name), v_property.title), '/dashboard/prospects');

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_property_inquiry(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_property_inquiry(UUID, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

COMMIT;
