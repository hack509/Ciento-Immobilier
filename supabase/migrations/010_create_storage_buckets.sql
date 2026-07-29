-- =====================================================
-- Ciento-Immobilier: Storage Buckets
-- =====================================================

-- =====================================================
-- 1. Property Images Bucket
-- =====================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'property-images',
  'property-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 2. Storage RLS Policies for property-images
-- =====================================================

-- Anyone can view property images (public bucket)
CREATE POLICY "property_images_public_select"
ON storage.objects FOR SELECT
USING (bucket_id = 'property-images');

-- Authenticated users can upload to property-images
CREATE POLICY "property_images_auth_insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'property-images'
  AND auth.role() = 'authenticated'
);

-- Users can update their own uploads
CREATE POLICY "property_images_auth_update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'property-images'
  AND auth.role() = 'authenticated'
)
WITH CHECK (
  bucket_id = 'property-images'
);

-- Users can delete their own uploads
CREATE POLICY "property_images_auth_delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'property-images'
  AND auth.role() = 'authenticated'
);
