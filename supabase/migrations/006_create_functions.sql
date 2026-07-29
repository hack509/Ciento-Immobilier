-- =====================================================
-- Ciento-Immobilier: Functions & Triggers
-- =====================================================

-- =====================================================
-- 1. Auto-update updated_at timestamp
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_agencies_updated_at
  BEFORE UPDATE ON agencies FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_agents_updated_at
  BEFORE UPDATE ON agents FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_properties_updated_at
  BEFORE UPDATE ON properties FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_blog_posts_updated_at
  BEFORE UPDATE ON blog_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_reports_updated_at
  BEFORE UPDATE ON reports FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_site_settings_updated_at
  BEFORE UPDATE ON site_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- 2. Increment property views
-- =====================================================
CREATE OR REPLACE FUNCTION increment_property_views(property_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE properties
  SET views_count = views_count + 1
  WHERE id = property_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. Update property favorites count
-- =====================================================
CREATE OR REPLACE FUNCTION update_property_favorites_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE properties
    SET favorites_count = favorites_count + 1
    WHERE id = NEW.property_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE properties
    SET favorites_count = favorites_count - 1
    WHERE id = OLD.property_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_favorites_count
  AFTER INSERT OR DELETE ON favorites
  FOR EACH ROW EXECUTE FUNCTION update_property_favorites_count();

-- =====================================================
-- 4. Update agency properties count
-- =====================================================
CREATE OR REPLACE FUNCTION update_agency_properties_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.agency_id IS NOT NULL THEN
    UPDATE agencies
    SET properties_count = properties_count + 1
    WHERE id = NEW.agency_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' AND OLD.agency_id IS NOT NULL THEN
    UPDATE agencies
    SET properties_count = properties_count - 1
    WHERE id = OLD.agency_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.agency_id IS DISTINCT FROM NEW.agency_id THEN
      IF OLD.agency_id IS NOT NULL THEN
        UPDATE agencies
        SET properties_count = properties_count - 1
        WHERE id = OLD.agency_id;
      END IF;
      IF NEW.agency_id IS NOT NULL THEN
        UPDATE agencies
        SET properties_count = properties_count + 1
        WHERE id = NEW.agency_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_agency_properties_count
  AFTER INSERT OR UPDATE OR DELETE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_agency_properties_count();

-- =====================================================
-- 5. Update agent properties count
-- =====================================================
CREATE OR REPLACE FUNCTION update_agent_properties_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.agent_id IS NOT NULL THEN
    UPDATE agents
    SET properties_count = properties_count + 1
    WHERE id = NEW.agent_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' AND OLD.agent_id IS NOT NULL THEN
    UPDATE agents
    SET properties_count = properties_count - 1
    WHERE id = OLD.agent_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.agent_id IS DISTINCT FROM NEW.agent_id THEN
      IF OLD.agent_id IS NOT NULL THEN
        UPDATE agents
        SET properties_count = properties_count - 1
        WHERE id = OLD.agent_id;
      END IF;
      IF NEW.agent_id IS NOT NULL THEN
        UPDATE agents
        SET properties_count = properties_count + 1
        WHERE id = NEW.agent_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_agent_properties_count
  AFTER INSERT OR UPDATE OR DELETE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_agent_properties_count();

-- =====================================================
-- 6. Update conversation timestamp on new message
-- =====================================================
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_conversation_on_message
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_on_message();

-- =====================================================
-- 7. Slug generation function
-- =====================================================
CREATE OR REPLACE FUNCTION generate_slug(input_text TEXT)
RETURNS TEXT AS $$
DECLARE
  result TEXT;
BEGIN
  result := lower(trim(regexp_replace(
    regexp_replace(
      unaccent(input_text),
      '[^a-zA-Z0-9\s-]', '', 'g'
    ),
    '[\s]+', '-', 'g'
  ), '-'));
  RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- 8. Auto-generate property slug
-- =====================================================
CREATE OR REPLACE FUNCTION generate_property_slug()
RETURNS TRIGGER AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INT := 0;
BEGIN
  base_slug := generate_slug(NEW.title);
  final_slug := base_slug;

  WHILE EXISTS (SELECT 1 FROM properties WHERE slug = final_slug AND id != COALESCE(NEW.id, gen_random_uuid())) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  NEW.slug := final_slug;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_property_slug
  BEFORE INSERT OR UPDATE OF title ON properties
  FOR EACH ROW EXECUTE FUNCTION generate_property_slug();

-- =====================================================
-- 9. Auto-generate agency slug
-- =====================================================
CREATE OR REPLACE FUNCTION generate_agency_slug()
RETURNS TRIGGER AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INT := 0;
BEGIN
  base_slug := generate_slug(NEW.name);
  final_slug := base_slug;

  WHILE EXISTS (SELECT 1 FROM agencies WHERE slug = final_slug AND id != COALESCE(NEW.id, gen_random_uuid())) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  NEW.slug := final_slug;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_agency_slug
  BEFORE INSERT OR UPDATE OF name ON agencies
  FOR EACH ROW EXECUTE FUNCTION generate_agency_slug();

-- =====================================================
-- 10. Auto-generate blog post slug
-- =====================================================
CREATE OR REPLACE FUNCTION generate_blog_post_slug()
RETURNS TRIGGER AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INT := 0;
BEGIN
  base_slug := generate_slug(NEW.title);
  final_slug := base_slug;

  WHILE EXISTS (SELECT 1 FROM blog_posts WHERE slug = final_slug AND id != COALESCE(NEW.id, gen_random_uuid())) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  NEW.slug := final_slug;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_blog_post_slug
  BEFORE INSERT OR UPDATE OF title ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION generate_blog_post_slug();

-- =====================================================
-- 11. Update review ratings aggregate
-- =====================================================
CREATE OR REPLACE FUNCTION update_review_aggregate()
RETURNS TRIGGER AS $$
DECLARE
  target_table TEXT;
  avg_rating DOUBLE PRECISION;
  total_reviews INT;
BEGIN
  -- Determine target type
  IF TG_OP = 'DELETE' THEN
    target_table := CASE OLD.target_type
      WHEN 'agent' THEN 'agents'
      WHEN 'agency' THEN 'agencies'
    END;
  ELSE
    target_table := CASE NEW.target_type
      WHEN 'agent' THEN 'agents'
      WHEN 'agency' THEN 'agencies'
    END;
  END IF;

  -- Calculate new aggregates for the affected target
  IF TG_OP = 'DELETE' THEN
    SELECT AVG(rating)::DOUBLE PRECISION, COUNT(*)
    INTO avg_rating, total_reviews
    FROM reviews
    WHERE target_id = OLD.target_id
      AND target_type = OLD.target_type
      AND is_published = true;

    IF target_table = 'agents' THEN
      UPDATE agents SET
        rating_avg = COALESCE(avg_rating, 0),
        rating_count = COALESCE(total_reviews, 0)
      WHERE id = OLD.target_id;
    ELSE
      UPDATE agencies SET
        rating_avg = COALESCE(avg_rating, 0),
        rating_count = COALESCE(total_reviews, 0)
      WHERE id = OLD.target_id;
    END IF;
  ELSE
    SELECT AVG(rating)::DOUBLE PRECISION, COUNT(*)
    INTO avg_rating, total_reviews
    FROM reviews
    WHERE target_id = NEW.target_id
      AND target_type = NEW.target_type
      AND is_published = true;

    IF target_table = 'agents' THEN
      UPDATE agents SET
        rating_avg = COALESCE(avg_rating, 0),
        rating_count = COALESCE(total_reviews, 0)
      WHERE id = NEW.target_id;
    ELSE
      UPDATE agencies SET
        rating_avg = COALESCE(avg_rating, 0),
        rating_count = COALESCE(total_reviews, 0)
      WHERE id = NEW.target_id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_review_aggregate
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_review_aggregate();
