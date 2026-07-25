-- =====================================================
-- Ciento-Immobilier: Custom ENUM Types
-- =====================================================

CREATE TYPE user_role AS ENUM (
  'super_admin',
  'admin',
  'agency',
  'agent',
  'owner',
  'client'
);

CREATE TYPE property_status AS ENUM (
  'draft',
  'pending',
  'active',
  'sold',
  'rented',
  'expired',
  'suspended'
);

CREATE TYPE property_type AS ENUM (
  'house',
  'apartment',
  'land',
  'commercial',
  'building',
  'villa'
);

CREATE TYPE listing_type AS ENUM (
  'sale',
  'rent',
  'sale_or_rent'
);

CREATE TYPE appointment_status AS ENUM (
  'pending',
  'confirmed',
  'completed',
  'cancelled'
);

CREATE TYPE message_status AS ENUM (
  'unread',
  'read',
  'archived'
);

CREATE TYPE notification_type AS ENUM (
  'message',
  'appointment',
  'property',
  'system',
  'review'
);

CREATE TYPE transaction_status AS ENUM (
  'pending',
  'completed',
  'cancelled',
  'refunded'
);

CREATE TYPE report_status AS ENUM (
  'pending',
  'reviewed',
  'resolved',
  'dismissed'
);

CREATE TYPE report_target_type AS ENUM (
  'property',
  'user',
  'review',
  'message'
);

CREATE TYPE review_target_type AS ENUM (
  'agent',
  'agency'
);
