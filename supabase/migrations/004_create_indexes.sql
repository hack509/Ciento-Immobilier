-- =====================================================
-- Ciento-Immobilier: Indexes
-- =====================================================
-- Performance indexes for all query-heavy columns

-- PROFILES
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_city_id ON profiles(city_id);
CREATE INDEX idx_profiles_is_active ON profiles(is_active);
CREATE INDEX idx_profiles_created_at ON profiles(created_at DESC);

-- CITIES
CREATE INDEX idx_cities_slug ON cities(slug);
CREATE INDEX idx_cities_is_active ON cities(is_active);

-- NEIGHBORHOODS
CREATE INDEX idx_neighborhoods_city_id ON neighborhoods(city_id);
CREATE INDEX idx_neighborhoods_slug ON neighborhoods(city_id, slug);
CREATE INDEX idx_neighborhoods_is_active ON neighborhoods(is_active);

-- CATEGORIES
CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_is_active ON categories(is_active);
CREATE INDEX idx_categories_sort_order ON categories(sort_order);

-- AMENITIES
CREATE INDEX idx_amenities_slug ON amenities(slug);
CREATE INDEX idx_amenities_category ON amenities(category);
CREATE INDEX idx_amenities_is_active ON amenities(is_active);

-- AGENCIES
CREATE INDEX idx_agencies_owner_id ON agencies(owner_id);
CREATE INDEX idx_agencies_slug ON agencies(slug);
CREATE INDEX idx_agencies_city_id ON agencies(city_id);
CREATE INDEX idx_agencies_is_active ON agencies(is_active);
CREATE INDEX idx_agencies_is_verified ON agencies(is_verified);
CREATE INDEX idx_agencies_rating_avg ON agencies(rating_avg DESC);

-- AGENTS
CREATE INDEX idx_agents_profile_id ON agents(profile_id);
CREATE INDEX idx_agents_agency_id ON agents(agency_id);
CREATE INDEX idx_agents_is_active ON agents(is_active);
CREATE INDEX idx_agents_is_verified ON agents(is_verified);
CREATE INDEX idx_agents_rating_avg ON agents(rating_avg DESC);

-- PROPERTIES
CREATE INDEX idx_properties_owner_id ON properties(owner_id);
CREATE INDEX idx_properties_agent_id ON properties(agent_id);
CREATE INDEX idx_properties_agency_id ON properties(agency_id);
CREATE INDEX idx_properties_category_id ON properties(category_id);
CREATE INDEX idx_properties_city_id ON properties(city_id);
CREATE INDEX idx_properties_neighborhood_id ON properties(neighborhood_id);
CREATE INDEX idx_properties_slug ON properties(slug);
CREATE INDEX idx_properties_status ON properties(status);
CREATE INDEX idx_properties_property_type ON properties(property_type);
CREATE INDEX idx_properties_listing_type ON properties(listing_type);
CREATE INDEX idx_properties_price ON properties(price);
CREATE INDEX idx_properties_is_published ON properties(is_published);
CREATE INDEX idx_properties_is_featured ON properties(is_featured);
CREATE INDEX idx_properties_created_at ON properties(created_at DESC);
CREATE INDEX idx_properties_bedrooms ON properties(bedrooms);
CREATE INDEX idx_properties_bathrooms ON properties(bathrooms);

-- Composite index for main listing query
CREATE INDEX idx_properties_listing ON properties(is_published, status, created_at DESC)
  WHERE is_published = true AND status = 'active';

-- Composite index for featured properties
CREATE INDEX idx_properties_featured ON properties(is_featured, created_at DESC)
  WHERE is_published = true AND status = 'active';

-- Composite index for search (text search)
CREATE INDEX idx_properties_search ON properties USING gin(to_tsvector('french', title || ' ' || description));

-- PROPERTY IMAGES
CREATE INDEX idx_property_images_property_id ON property_images(property_id);
CREATE INDEX idx_property_images_is_primary ON property_images(property_id, is_primary);
CREATE INDEX idx_property_images_sort ON property_images(property_id, sort_order);

-- PROPERTY VIDEOS
CREATE INDEX idx_property_videos_property_id ON property_videos(property_id);

-- FAVORITES
CREATE INDEX idx_favorites_user_id ON favorites(user_id);
CREATE INDEX idx_favorites_property_id ON favorites(property_id);
CREATE INDEX idx_favorites_user_property ON favorites(user_id, property_id);

-- APPOINTMENTS
CREATE INDEX idx_appointments_property_id ON appointments(property_id);
CREATE INDEX idx_appointments_user_id ON appointments(user_id);
CREATE INDEX idx_appointments_agent_id ON appointments(agent_id);
CREATE INDEX idx_appointments_scheduled_at ON appointments(scheduled_at);
CREATE INDEX idx_appointments_status ON appointments(status);

-- CONVERSATIONS
CREATE INDEX idx_conversations_property_id ON conversations(property_id);
CREATE INDEX idx_conversations_updated_at ON conversations(updated_at DESC);

-- CONVERSATION PARTICIPANTS
CREATE INDEX idx_conv_participants_user ON conversation_participants(user_id);

-- MESSAGES
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_status ON messages(status);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);

-- NOTIFICATIONS
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_is_read ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- REVIEWS
CREATE INDEX idx_reviews_target ON reviews(target_id, target_type);
CREATE INDEX idx_reviews_reviewer_id ON reviews(reviewer_id);
CREATE INDEX idx_reviews_property_id ON reviews(property_id);
CREATE INDEX idx_reviews_rating ON reviews(rating);
CREATE INDEX idx_reviews_is_published ON reviews(is_published);

-- BLOG POSTS
CREATE INDEX idx_blog_posts_author_id ON blog_posts(author_id);
CREATE INDEX idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX idx_blog_posts_is_published ON blog_posts(is_published);
CREATE INDEX idx_blog_posts_published_at ON blog_posts(published_at DESC);

-- TRANSACTIONS
CREATE INDEX idx_transactions_property_id ON transactions(property_id);
CREATE INDEX idx_transactions_buyer_id ON transactions(buyer_id);
CREATE INDEX idx_transactions_seller_id ON transactions(seller_id);
CREATE INDEX idx_transactions_status ON transactions(status);

-- REPORTS
CREATE INDEX idx_reports_reporter_id ON reports(reporter_id);
CREATE INDEX idx_reports_target ON reports(target_type, target_id);
CREATE INDEX idx_reports_status ON reports(status);

-- ACTIVITY LOGS
CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_action ON activity_logs(action);
CREATE INDEX idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at DESC);
