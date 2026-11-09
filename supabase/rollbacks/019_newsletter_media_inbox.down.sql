-- Rollback of 019_newsletter_media_inbox.sql
-- WARNING: deletes contact messages, campaigns, consent history, external media
-- links and media reports. Export them first. Storage buckets and files are kept.
BEGIN;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['newsletter_campaigns', 'newsletter_subscribers', 'contact_messages'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS audit_%1$s ON public.%1$I', t);
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'contact_messages') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.contact_messages';
  END IF;
  IF to_regclass('storage.objects') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "avatars_public_select" ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS "avatars_owner_delete" ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS "property_videos_select" ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS "property_videos_delete" ON storage.objects';
    -- Restore direct uploads of 014.
    EXECUTE 'DROP POLICY IF EXISTS "property_images_auth_insert" ON storage.objects';
    EXECUTE 'CREATE POLICY "property_images_auth_insert" ON storage.objects FOR INSERT TO authenticated
             WITH CHECK (bucket_id = ''property-images'' AND public.can_manage_property_object(name))';
    EXECUTE 'DROP POLICY IF EXISTS "property_images_auth_update" ON storage.objects';
    EXECUTE 'CREATE POLICY "property_images_auth_update" ON storage.objects FOR UPDATE TO authenticated
             USING (bucket_id = ''property-images'' AND public.can_manage_property_object(name))
             WITH CHECK (bucket_id = ''property-images'' AND public.can_manage_property_object(name))';
    UPDATE storage.buckets SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    WHERE id = 'property-images';
  END IF;
END $$;

DROP TRIGGER IF EXISTS validate_profile_avatar ON public.profiles;
DROP FUNCTION IF EXISTS public.validate_profile_avatar();

-- Media
DROP FUNCTION IF EXISTS public.list_orphan_media_objects(INTERVAL);
DROP FUNCTION IF EXISTS public.admin_moderate_media(TEXT, UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.report_property_media(TEXT, UUID, TEXT);
DROP TABLE IF EXISTS public.media_reports;
DROP VIEW IF EXISTS public.property_media;
DROP TRIGGER IF EXISTS guard_property_images ON public.property_images;
DROP TRIGGER IF EXISTS guard_property_videos ON public.property_videos;
DROP FUNCTION IF EXISTS public.guard_property_media();
DROP FUNCTION IF EXISTS public.media_limit(TEXT);
DROP POLICY IF EXISTS "property_videos_manage_agency" ON public.property_videos;

DROP POLICY IF EXISTS "property_images_select_public" ON public.property_images;
CREATE POLICY "property_images_select_public" ON public.property_images
  FOR SELECT USING (
    property_id IN (SELECT id FROM public.properties WHERE is_published AND status = 'active')
    OR property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid())
  );
DROP POLICY IF EXISTS "property_videos_select_public" ON public.property_videos;
CREATE POLICY "property_videos_select_public" ON public.property_videos
  FOR SELECT USING (property_id IN (SELECT id FROM public.properties WHERE is_published = TRUE AND status = 'active'));

DELETE FROM public.property_images WHERE source = 'external';
DELETE FROM public.property_videos WHERE source <> 'upload';
ALTER TABLE public.property_images
  DROP CONSTRAINT IF EXISTS property_images_source_check,
  DROP CONSTRAINT IF EXISTS property_images_moderation_check,
  DROP COLUMN IF EXISTS source, DROP COLUMN IF EXISTS external_url, DROP COLUMN IF EXISTS thumbnail_path,
  DROP COLUMN IF EXISTS mime_type, DROP COLUMN IF EXISTS size_bytes, DROP COLUMN IF EXISTS moderation_status,
  DROP COLUMN IF EXISTS moderation_note, DROP COLUMN IF EXISTS flag_count, DROP COLUMN IF EXISTS uploaded_by;
ALTER TABLE public.property_images ALTER COLUMN storage_path SET NOT NULL;
ALTER TABLE public.property_videos
  DROP CONSTRAINT IF EXISTS property_videos_source_check,
  DROP CONSTRAINT IF EXISTS property_videos_moderation_check,
  DROP COLUMN IF EXISTS source, DROP COLUMN IF EXISTS provider_video_id, DROP COLUMN IF EXISTS mime_type,
  DROP COLUMN IF EXISTS size_bytes, DROP COLUMN IF EXISTS moderation_status, DROP COLUMN IF EXISTS moderation_note,
  DROP COLUMN IF EXISTS flag_count, DROP COLUMN IF EXISTS uploaded_by;
DROP INDEX IF EXISTS public.idx_property_videos_property;

-- Contact inbox
DROP TRIGGER IF EXISTS mirror_inquiry_to_inbox ON public.property_inquiries;
DROP TRIGGER IF EXISTS mirror_service_request_to_inbox ON public.service_requests;
DROP FUNCTION IF EXISTS public.mirror_to_contact_inbox();
DROP FUNCTION IF EXISTS public.admin_inbox_counts();
DROP FUNCTION IF EXISTS public.submit_contact_message(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID);
DROP FUNCTION IF EXISTS public.notify_admins(TEXT, TEXT, TEXT);
DROP TABLE IF EXISTS public.contact_message_history;
DROP TABLE IF EXISTS public.contact_message_notes;
DROP TABLE IF EXISTS public.contact_messages;
DROP FUNCTION IF EXISTS public.track_contact_note();
DROP FUNCTION IF EXISTS public.track_contact_message_change();

-- Newsletter
DROP FUNCTION IF EXISTS public.record_email_event(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.record_newsletter_batch(UUID, JSONB);
DROP FUNCTION IF EXISTS public.claim_newsletter_batch(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.admin_start_newsletter_campaign(UUID, TEXT);
DROP TABLE IF EXISTS public.newsletter_campaign_logs;
DROP TABLE IF EXISTS public.newsletter_campaigns;
DROP FUNCTION IF EXISTS public.protect_newsletter_campaign();
DROP FUNCTION IF EXISTS public.admin_newsletter_stats();
DROP FUNCTION IF EXISTS public.record_newsletter_request(TEXT, TEXT, TEXT, TEXT);
DROP POLICY IF EXISTS "newsletter_admin_delete" ON public.newsletter_subscribers;
DROP TRIGGER IF EXISTS log_newsletter_consent ON public.newsletter_subscribers;
DROP TRIGGER IF EXISTS sync_newsletter_status ON public.newsletter_subscribers;
DROP FUNCTION IF EXISTS public.log_newsletter_consent();
DROP FUNCTION IF EXISTS public.sync_newsletter_status();
DROP TABLE IF EXISTS public.newsletter_consent_events;
DROP INDEX IF EXISTS public.idx_newsletter_status_created;
-- is_active / unsubscribed_at stayed in sync, so the legacy model is intact.
ALTER TABLE public.newsletter_subscribers
  DROP CONSTRAINT IF EXISTS newsletter_subscribers_status_check,
  DROP COLUMN IF EXISTS status, DROP COLUMN IF EXISTS source, DROP COLUMN IF EXISTS consented_at,
  DROP COLUMN IF EXISTS confirmed_at, DROP COLUMN IF EXISTS suspended_reason, DROP COLUMN IF EXISTS archived_at,
  DROP COLUMN IF EXISTS updated_at;

DROP FUNCTION IF EXISTS public.request_user_agent();
DROP FUNCTION IF EXISTS public.request_ip_hash();

DELETE FROM public.site_settings WHERE key IN (
  'max_image_upload_mb', 'max_video_upload_mb', 'max_videos_per_property', 'max_avatar_upload_mb', 'contact_rate_limit_per_hour'
);

COMMIT;
