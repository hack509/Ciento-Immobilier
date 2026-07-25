-- =====================================================
-- Ciento-Immobilier: Row-Level Security (RLS) Policies
-- =====================================================
-- Enable RLS on all tables and define access policies

-- =====================================================
-- Enable RLS
-- =====================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE neighborhoods ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE amenities ENABLE ROW LEVEL SECURITY;
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_amenities ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- Helper: Get current user's role
-- =====================================================
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =====================================================
-- Helper: Check if user is admin
-- =====================================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT get_user_role() IN ('super_admin', 'admin');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =====================================================
-- Helper: Check if user is super_admin
-- =====================================================
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT get_user_role() = 'super_admin';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =====================================================
-- PROFILES
-- =====================================================
-- Everyone can view profiles (public info)
CREATE POLICY "profiles_select_public" ON profiles
  FOR SELECT USING (true);

-- Users can update their own profile
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- Users can insert their own profile (trigger handles this)
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- Admins can update any profile
CREATE POLICY "profiles_update_admin" ON profiles
  FOR UPDATE USING (is_admin());

-- Admins can view all profiles (already covered by public select)

-- =====================================================
-- CITIES
-- =====================================================
-- Everyone can view active cities
CREATE POLICY "cities_select_public" ON cities
  FOR SELECT USING (is_active = true);

-- Admins can manage cities
CREATE POLICY "cities_insert_admin" ON cities
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "cities_update_admin" ON cities
  FOR UPDATE USING (is_admin());

CREATE POLICY "cities_delete_admin" ON cities
  FOR DELETE USING (is_admin());

-- =====================================================
-- NEIGHBORHOODS
-- =====================================================
CREATE POLICY "neighborhoods_select_public" ON neighborhoods
  FOR SELECT USING (is_active = true);

CREATE POLICY "neighborhoods_insert_admin" ON neighborhoods
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "neighborhoods_update_admin" ON neighborhoods
  FOR UPDATE USING (is_admin());

CREATE POLICY "neighborhoods_delete_admin" ON neighborhoods
  FOR DELETE USING (is_admin());

-- =====================================================
-- CATEGORIES
-- =====================================================
CREATE POLICY "categories_select_public" ON categories
  FOR SELECT USING (is_active = true);

CREATE POLICY "categories_insert_admin" ON categories
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "categories_update_admin" ON categories
  FOR UPDATE USING (is_admin());

CREATE POLICY "categories_delete_admin" ON categories
  FOR DELETE USING (is_admin());

-- =====================================================
-- AMENITIES
-- =====================================================
CREATE POLICY "amenities_select_public" ON amenities
  FOR SELECT USING (is_active = true);

CREATE POLICY "amenities_insert_admin" ON amenities
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "amenities_update_admin" ON amenities
  FOR UPDATE USING (is_admin());

CREATE POLICY "amenities_delete_admin" ON amenities
  FOR DELETE USING (is_admin());

-- =====================================================
-- AGENCIES
-- =====================================================
-- Everyone can view active agencies
CREATE POLICY "agencies_select_public" ON agencies
  FOR SELECT USING (is_active = true);

-- Agency owners can manage their own agency
CREATE POLICY "agencies_insert_own" ON agencies
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "agencies_update_own" ON agencies
  FOR UPDATE USING (owner_id = auth.uid());

-- Admins can manage all agencies
CREATE POLICY "agencies_update_admin" ON agencies
  FOR UPDATE USING (is_admin());

CREATE POLICY "agencies_delete_admin" ON agencies
  FOR DELETE USING (is_admin());

-- =====================================================
-- AGENTS
-- =====================================================
-- Everyone can view active agents
CREATE POLICY "agents_select_public" ON agents
  FOR SELECT USING (is_active = true);

-- Users can register as agents (insert own)
CREATE POLICY "agents_insert_own" ON agents
  FOR INSERT WITH CHECK (profile_id = auth.uid());

-- Agents can update their own profile
CREATE POLICY "agents_update_own" ON agents
  FOR UPDATE USING (profile_id = auth.uid());

-- Agency owners can manage their agents
CREATE POLICY "agents_update_agency_owner" ON agents
  FOR UPDATE USING (
    agency_id IN (SELECT id FROM agencies WHERE owner_id = auth.uid())
  );

-- Admins can manage all agents
CREATE POLICY "agents_update_admin" ON agents
  FOR UPDATE USING (is_admin());

CREATE POLICY "agents_delete_admin" ON agents
  FOR DELETE USING (is_admin());

-- =====================================================
-- PROPERTIES
-- =====================================================
-- Everyone can view published active properties
CREATE POLICY "properties_select_public" ON properties
  FOR SELECT USING (is_published = true AND status = 'active');

-- Owners can view their own properties (including drafts)
CREATE POLICY "properties_select_own" ON properties
  FOR SELECT USING (owner_id = auth.uid());

-- Agents can view properties assigned to them
CREATE POLICY "properties_select_agent" ON properties
  FOR SELECT USING (
    agent_id IN (SELECT id FROM agents WHERE profile_id = auth.uid())
  );

-- Admins can view all properties
CREATE POLICY "properties_select_admin" ON properties
  FOR SELECT USING (is_admin());

-- Authenticated users can create properties
CREATE POLICY "properties_insert_own" ON properties
  FOR INSERT WITH CHECK (
    owner_id = auth.uid() AND
    auth.uid() IS NOT NULL
  );

-- Owners can update their own properties
CREATE POLICY "properties_update_own" ON properties
  FOR UPDATE USING (owner_id = auth.uid());

-- Admins can update any property
CREATE POLICY "properties_update_admin" ON properties
  FOR UPDATE USING (is_admin());

-- Owners can delete their own properties
CREATE POLICY "properties_delete_own" ON properties
  FOR DELETE USING (owner_id = auth.uid());

-- Admins can delete any property
CREATE POLICY "properties_delete_admin" ON properties
  FOR DELETE USING (is_admin());

-- =====================================================
-- PROPERTY IMAGES
-- =====================================================
-- Public read for published property images
CREATE POLICY "property_images_select_public" ON property_images
  FOR SELECT USING (
    property_id IN (
      SELECT id FROM properties WHERE is_published = true AND status = 'active'
    )
  );

-- Property owners can manage their images
CREATE POLICY "property_images_insert_own" ON property_images
  FOR INSERT WITH CHECK (
    property_id IN (SELECT id FROM properties WHERE owner_id = auth.uid())
  );

CREATE POLICY "property_images_delete_own" ON property_images
  FOR DELETE USING (
    property_id IN (SELECT id FROM properties WHERE owner_id = auth.uid())
  );

CREATE POLICY "property_images_update_own" ON property_images
  FOR UPDATE USING (
    property_id IN (SELECT id FROM properties WHERE owner_id = auth.uid())
  );

-- Admins can manage all images
CREATE POLICY "property_images_all_admin" ON property_images
  FOR ALL USING (is_admin());

-- =====================================================
-- PROPERTY VIDEOS
-- =====================================================
CREATE POLICY "property_videos_select_public" ON property_videos
  FOR SELECT USING (
    property_id IN (
      SELECT id FROM properties WHERE is_published = true AND status = 'active'
    )
  );

CREATE POLICY "property_videos_insert_own" ON property_videos
  FOR INSERT WITH CHECK (
    property_id IN (SELECT id FROM properties WHERE owner_id = auth.uid())
  );

CREATE POLICY "property_videos_delete_own" ON property_videos
  FOR DELETE USING (
    property_id IN (SELECT id FROM properties WHERE owner_id = auth.uid())
  );

CREATE POLICY "property_videos_all_admin" ON property_videos
  FOR ALL USING (is_admin());

-- =====================================================
-- PROPERTY AMENITIES
-- =====================================================
CREATE POLICY "property_amenities_select_public" ON property_amenities
  FOR SELECT USING (
    property_id IN (
      SELECT id FROM properties WHERE is_published = true AND status = 'active'
    )
  );

CREATE POLICY "property_amenities_manage_own" ON property_amenities
  FOR ALL USING (
    property_id IN (SELECT id FROM properties WHERE owner_id = auth.uid())
  );

CREATE POLICY "property_amenities_all_admin" ON property_amenities
  FOR ALL USING (is_admin());

-- =====================================================
-- FAVORITES
-- =====================================================
-- Users can only see their own favorites
CREATE POLICY "favorites_select_own" ON favorites
  FOR SELECT USING (user_id = auth.uid());

-- Users can add favorites
CREATE POLICY "favorites_insert_own" ON favorites
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can remove their own favorites
CREATE POLICY "favorites_delete_own" ON favorites
  FOR DELETE USING (user_id = auth.uid());

-- =====================================================
-- APPOINTMENTS
-- =====================================================
-- Users can see their own appointments
CREATE POLICY "appointments_select_own" ON appointments
  FOR SELECT USING (user_id = auth.uid());

-- Agents can see appointments assigned to them
CREATE POLICY "appointments_select_agent" ON appointments
  FOR SELECT USING (
    agent_id IN (SELECT id FROM agents WHERE profile_id = auth.uid())
  );

-- Admins can see all appointments
CREATE POLICY "appointments_select_admin" ON appointments
  FOR SELECT USING (is_admin());

-- Users can create appointments
CREATE POLICY "appointments_insert_own" ON appointments
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own appointments (cancel)
CREATE POLICY "appointments_update_own" ON appointments
  FOR UPDATE USING (user_id = auth.uid());

-- Agents can update appointments assigned to them (confirm/complete)
CREATE POLICY "appointments_update_agent" ON appointments
  FOR UPDATE USING (
    agent_id IN (SELECT id FROM agents WHERE profile_id = auth.uid())
  );

-- Admins can manage all appointments
CREATE POLICY "appointments_update_admin" ON appointments
  FOR UPDATE USING (is_admin());

-- =====================================================
-- CONVERSATIONS
-- =====================================================
-- Users can see conversations they participate in
CREATE POLICY "conversations_select_participant" ON conversations
  FOR SELECT USING (
    id IN (
      SELECT conversation_id FROM conversation_participants
      WHERE user_id = auth.uid()
    )
  );

-- Authenticated users can create conversations
CREATE POLICY "conversations_insert_own" ON conversations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- =====================================================
-- CONVERSATION PARTICIPANTS
-- =====================================================
-- Users can see participants of their conversations
CREATE POLICY "conv_participants_select_own" ON conversation_participants
  FOR SELECT USING (
    conversation_id IN (
      SELECT conversation_id FROM conversation_participants
      WHERE user_id = auth.uid()
    )
  );

-- Users can add themselves to conversations
CREATE POLICY "conv_participants_insert_own" ON conversation_participants
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- =====================================================
-- MESSAGES
-- =====================================================
-- Users can see messages in their conversations
CREATE POLICY "messages_select_participant" ON messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT conversation_id FROM conversation_participants
      WHERE user_id = auth.uid()
    )
  );

-- Participants can send messages
CREATE POLICY "messages_insert_participant" ON messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    conversation_id IN (
      SELECT conversation_id FROM conversation_participants
      WHERE user_id = auth.uid()
    )
  );

-- Senders can update their own messages (read status)
CREATE POLICY "messages_update_own" ON messages
  FOR UPDATE USING (sender_id = auth.uid());

-- Participants can mark messages as read
CREATE POLICY "messages_update_participant" ON messages
  FOR UPDATE USING (
    conversation_id IN (
      SELECT conversation_id FROM conversation_participants
      WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- NOTIFICATIONS
-- =====================================================
-- Users can see their own notifications
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT USING (user_id = auth.uid());

-- System can create notifications (via functions)
CREATE POLICY "notifications_insert_system" ON notifications
  FOR INSERT WITH CHECK (true);

-- Users can update their own (mark as read)
CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

-- Users can delete their own
CREATE POLICY "notifications_delete_own" ON notifications
  FOR DELETE USING (user_id = auth.uid());

-- =====================================================
-- REVIEWS
-- =====================================================
-- Everyone can view published reviews
CREATE POLICY "reviews_select_public" ON reviews
  FOR SELECT USING (is_published = true);

-- Users can see their own reviews (even unpublished)
CREATE POLICY "reviews_select_own" ON reviews
  FOR SELECT USING (reviewer_id = auth.uid());

-- Admins can see all reviews
CREATE POLICY "reviews_select_admin" ON reviews
  FOR SELECT USING (is_admin());

-- Users can create reviews
CREATE POLICY "reviews_insert_own" ON reviews
  FOR INSERT WITH CHECK (reviewer_id = auth.uid());

-- Users can update their own reviews
CREATE POLICY "reviews_update_own" ON reviews
  FOR UPDATE USING (reviewer_id = auth.uid());

-- Admins can manage all reviews
CREATE POLICY "reviews_update_admin" ON reviews
  FOR UPDATE USING (is_admin());

CREATE POLICY "reviews_delete_admin" ON reviews
  FOR DELETE USING (is_admin());

-- =====================================================
-- BLOG POSTS
-- =====================================================
-- Everyone can view published posts
CREATE POLICY "blog_posts_select_public" ON blog_posts
  FOR SELECT USING (is_published = true);

-- Authors can see their own posts
CREATE POLICY "blog_posts_select_own" ON blog_posts
  FOR SELECT USING (author_id = auth.uid());

-- Admins can manage all posts
CREATE POLICY "blog_posts_all_admin" ON blog_posts
  FOR ALL USING (is_admin());

-- =====================================================
-- TRANSACTIONS
-- =====================================================
-- Users can see their own transactions
CREATE POLICY "transactions_select_own" ON transactions
  FOR SELECT USING (
    buyer_id = auth.uid() OR seller_id = auth.uid()
  );

-- Admins can see all transactions
CREATE POLICY "transactions_select_admin" ON transactions
  FOR SELECT USING (is_admin());

-- Admins can manage all transactions
CREATE POLICY "transactions_all_admin" ON transactions
  FOR ALL USING (is_admin());

-- =====================================================
-- REPORTS
-- =====================================================
-- Users can see their own reports
CREATE POLICY "reports_select_own" ON reports
  FOR SELECT USING (reporter_id = auth.uid());

-- Admins can see all reports
CREATE POLICY "reports_select_admin" ON reports
  FOR SELECT USING (is_admin());

-- Users can create reports
CREATE POLICY "reports_insert_own" ON reports
  FOR INSERT WITH CHECK (reporter_id = auth.uid());

-- Admins can manage all reports
CREATE POLICY "reports_all_admin" ON reports
  FOR ALL USING (is_admin());

-- =====================================================
-- SITE SETTINGS
-- =====================================================
-- Everyone can read settings
CREATE POLICY "site_settings_select_public" ON site_settings
  FOR SELECT USING (true);

-- Only super_admin can modify settings
CREATE POLICY "site_settings_all_super_admin" ON site_settings
  FOR ALL USING (is_super_admin());

-- =====================================================
-- ACTIVITY LOGS
-- =====================================================
-- Users can see their own logs
CREATE POLICY "activity_logs_select_own" ON activity_logs
  FOR SELECT USING (user_id = auth.uid());

-- Admins can see all logs
CREATE POLICY "activity_logs_select_admin" ON activity_logs
  FOR SELECT USING (is_admin());

-- System can insert logs
CREATE POLICY "activity_logs_insert_system" ON activity_logs
  FOR INSERT WITH CHECK (true);
