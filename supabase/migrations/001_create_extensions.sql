-- =====================================================
-- Ciento-Immobilier: Extensions
-- =====================================================
-- Enable required PostgreSQL extensions
-- pgcrypto: provides gen_random_uuid() for modern UUID generation
-- unaccent: provides unaccent() for accent-insensitive slug generation

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "unaccent";
