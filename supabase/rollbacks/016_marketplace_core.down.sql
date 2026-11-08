-- Rollback of 016_marketplace_core.sql (restores the 014 behaviour).
-- WARNING: deletes inquiries, agency members and daily statistics.
BEGIN;

DROP TRIGGER IF EXISTS track_favorite_daily_stat ON public.favorites;
DROP TRIGGER IF EXISTS validate_property_affiliation ON public.properties;
DROP TRIGGER IF EXISTS protect_property_server_fields ON public.properties;
DROP TRIGGER IF EXISTS limit_agencies_per_owner ON public.agencies;

DROP POLICY IF EXISTS "properties_select_agency" ON public.properties;
DROP POLICY IF EXISTS "properties_update_agency" ON public.properties;
DROP POLICY IF EXISTS "properties_delete_agency" ON public.properties;
DROP POLICY IF EXISTS "property_images_manage_agency" ON public.property_images;
DROP POLICY IF EXISTS "property_amenities_manage_agency" ON public.property_amenities;
DROP POLICY IF EXISTS "site_settings_select_admin" ON public.site_settings;

-- Restore the owner policies of 014 / 005.
DROP POLICY IF EXISTS "properties_update_own" ON public.properties;
CREATE POLICY "properties_update_own" ON public.properties
  FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS "properties_delete_own" ON public.properties;
CREATE POLICY "properties_delete_own" ON public.properties
  FOR DELETE USING (owner_id = auth.uid());
DROP POLICY IF EXISTS "property_images_insert_own" ON public.property_images;
CREATE POLICY "property_images_insert_own" ON public.property_images
  FOR INSERT WITH CHECK (property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid()));
DROP POLICY IF EXISTS "property_images_update_own" ON public.property_images;
CREATE POLICY "property_images_update_own" ON public.property_images
  FOR UPDATE USING (property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid()));
DROP POLICY IF EXISTS "property_images_delete_own" ON public.property_images;
CREATE POLICY "property_images_delete_own" ON public.property_images
  FOR DELETE USING (property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid()));

-- 014 versions
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

DROP FUNCTION IF EXISTS public.submit_property_inquiry(UUID, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.track_favorite_daily_stat();
DROP FUNCTION IF EXISTS public.bump_property_daily_stat(UUID, TEXT);
DROP FUNCTION IF EXISTS public.add_agency_member(UUID, TEXT, public.agency_member_role, TEXT);
DROP FUNCTION IF EXISTS public.agency_member_limit(UUID);
DROP FUNCTION IF EXISTS public.validate_property_affiliation();
DROP FUNCTION IF EXISTS public.protect_property_server_fields();
DROP FUNCTION IF EXISTS public.protect_inquiry_fields() CASCADE;
DROP FUNCTION IF EXISTS public.protect_agency_member_fields() CASCADE;
DROP FUNCTION IF EXISTS public.limit_agencies_per_owner();

DROP VIEW IF EXISTS public.public_agency_team;
DROP TABLE IF EXISTS public.property_daily_stats;
DROP TABLE IF EXISTS public.property_inquiries;
DROP TABLE IF EXISTS public.agency_members;

DROP FUNCTION IF EXISTS public.has_agency_permission(UUID, TEXT);
DROP FUNCTION IF EXISTS public.can_manage_agency(UUID);
DROP FUNCTION IF EXISTS public.is_agency_member(UUID);
DROP FUNCTION IF EXISTS public.is_agency_owner(UUID);
DROP FUNCTION IF EXISTS public.setting_bool(TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.setting_int(TEXT, INTEGER);

DROP TYPE IF EXISTS public.inquiry_status;
DROP TYPE IF EXISTS public.agency_member_role;

DROP INDEX IF EXISTS public.idx_properties_public_ranking;
DROP INDEX IF EXISTS public.idx_properties_building_area;
DROP INDEX IF EXISTS public.idx_properties_available_from;

ALTER TABLE public.properties
  DROP COLUMN IF EXISTS available_from,
  DROP COLUMN IF EXISTS sponsored_until,
  DROP COLUMN IF EXISTS premium_until,
  DROP COLUMN IF EXISTS premium_details;

ALTER TABLE public.agencies
  DROP CONSTRAINT IF EXISTS agencies_brand_color_hex,
  DROP CONSTRAINT IF EXISTS agencies_slug_format,
  DROP CONSTRAINT IF EXISTS agencies_website_http,
  DROP COLUMN IF EXISTS tagline,
  DROP COLUMN IF EXISTS brand_color,
  DROP COLUMN IF EXISTS team_intro,
  DROP COLUMN IF EXISTS verification_requested_at;

DELETE FROM public.site_settings WHERE key IN (
  'free_owner_listing_limit', 'free_agency_listing_limit', 'payments_simulation_enabled',
  'payment_checkout_ttl_minutes', 'inquiry_rate_limit_per_hour'
);

COMMIT;
