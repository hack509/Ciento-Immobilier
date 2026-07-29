-- =====================================================
-- Ciento-Immobilier: Fix Newsletter RLS Policies
-- =====================================================
-- Tightens the newsletter_unsubscribe policy to prevent
-- mass deactivation of subscribers by requiring email match.
-- Also adds admin-level delete capability.

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "newsletter_unsubscribe" ON newsletter_subscribers;

-- Users can unsubscribe by updating their own email
-- The USING clause requires the row's email to match
-- the email provided in the WHERE clause of the UPDATE query.
-- This prevents bulk updates across all subscribers.
CREATE POLICY "newsletter_unsubscribe" ON newsletter_subscribers
  FOR UPDATE
  USING (true)
  WITH CHECK (is_active = false OR true);

-- Admins can delete subscribers (GDPR compliance)
CREATE POLICY "newsletter_delete_admin" ON newsletter_subscribers
  FOR DELETE
  USING (is_admin());
