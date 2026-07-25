-- =====================================================
-- Ciento-Immobilier: Newsletter Subscribers
-- =====================================================

-- =====================================================
-- 1. TABLE
-- =====================================================
CREATE TABLE newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 2. INDEXES
-- =====================================================
CREATE UNIQUE INDEX idx_newsletter_email ON newsletter_subscribers(email);
CREATE INDEX idx_newsletter_active ON newsletter_subscribers(is_active) WHERE is_active = true;

-- =====================================================
-- 3. RLS
-- =====================================================
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Anyone can subscribe (anonymous or authenticated)
CREATE POLICY "newsletter_subscribe" ON newsletter_subscribers
  FOR INSERT
  WITH CHECK (true);

-- Users can unsubscribe by updating their own email
CREATE POLICY "newsletter_unsubscribe" ON newsletter_subscribers
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Admins can read all subscribers
CREATE POLICY "newsletter_admin_read" ON newsletter_subscribers
  FOR SELECT
  USING (is_admin());
