-- =====================================================
-- Ciento-Immobilier: Monetization (phases 5 & 7)
-- =====================================================
-- Subscription plans, subscriptions, payments, invoices, sponsored and
-- premium listings, real-estate services and advertising.
--
-- Security model
--   * Prices / limits live only in the database (admin-configurable).
--   * Clients never insert payments directly: checkout_* RPCs compute the
--     amount server-side and create a PENDING payment.
--   * A payment becomes SUCCEEDED only through confirm_payment() (service_role:
--     payment Edge Function after server-side provider verification) or
--     admin_confirm_payment() (manual / bank transfer, audited).
--   * Benefits (subscription, promotion) are activated only by fulfilment
--     inside the confirmation transaction. Confirmation is idempotent.
-- Seeds are configuration only: plans and offers are created INACTIVE with
-- price 0 so nothing is sold until an administrator sets real prices.
-- Rollback: supabase/rollbacks/017_monetization.down.sql

BEGIN;

-- =====================================================
-- 1. Types
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'billing_cycle') THEN
    CREATE TYPE public.billing_cycle AS ENUM ('monthly', 'yearly');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
    CREATE TYPE public.subscription_status AS ENUM ('pending_payment', 'trialing', 'active', 'past_due', 'cancelled', 'expired');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE public.payment_status AS ENUM ('pending', 'succeeded', 'failed', 'cancelled', 'refunded');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_purpose') THEN
    CREATE TYPE public.payment_purpose AS ENUM (
      'subscription', 'subscription_renewal', 'sponsored_listing', 'premium_listing', 'service', 'advertising'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'promotion_kind') THEN
    CREATE TYPE public.promotion_kind AS ENUM ('sponsored', 'premium');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'promotion_status') THEN
    CREATE TYPE public.promotion_status AS ENUM ('pending_payment', 'scheduled', 'active', 'expired', 'cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'service_request_status') THEN
    CREATE TYPE public.service_request_status AS ENUM ('new', 'in_progress', 'accepted', 'completed', 'cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ad_placement') THEN
    CREATE TYPE public.ad_placement AS ENUM ('home_banner', 'search_inline', 'property_sidebar', 'footer_banner');
  END IF;
END $$;

-- =====================================================
-- 2. Subscription plans (admin-configurable)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9_-]{2,40}$'),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 60),
  tier TEXT NOT NULL CHECK (tier IN ('starter', 'business', 'enterprise')),
  audience TEXT NOT NULL DEFAULT 'all' CHECK (audience IN ('owner', 'agency', 'all')),
  description TEXT,
  price_monthly NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price_monthly >= 0),
  price_yearly NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price_yearly >= 0),
  currency TEXT NOT NULL DEFAULT 'HTG' CHECK (currency IN ('HTG', 'USD')),
  max_active_listings INTEGER CHECK (max_active_listings IS NULL OR max_active_listings >= 0),
  featured_credits_per_period INTEGER NOT NULL DEFAULT 0 CHECK (featured_credits_per_period >= 0),
  max_members INTEGER CHECK (max_members IS NULL OR max_members >= 0),
  trial_days INTEGER NOT NULL DEFAULT 0 CHECK (trial_days BETWEEN 0 AND 90),
  features JSONB NOT NULL DEFAULT '[]'::JSONB CHECK (jsonb_typeof(features) = 'array'),
  capabilities JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(capabilities) = 'object'),
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  is_highlighted BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN public.subscription_plans.max_active_listings IS 'NULL = illimité';
COMMENT ON COLUMN public.subscription_plans.max_members IS 'Membres d''agence (hors titulaire). NULL = illimité';

-- =====================================================
-- 3. Subscriptions (user OR agency)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE,
  billing_cycle public.billing_cycle NOT NULL,
  status public.subscription_status NOT NULL DEFAULT 'pending_payment',
  price_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price_amount >= 0),
  currency TEXT NOT NULL DEFAULT 'HTG',
  trial_ends_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  cancelled_at TIMESTAMPTZ,
  featured_credits_remaining INTEGER NOT NULL DEFAULT 0 CHECK (featured_credits_remaining >= 0),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT subscriptions_one_subscriber CHECK ((user_id IS NULL) <> (agency_id IS NULL)),
  CONSTRAINT subscriptions_period_order CHECK (
    current_period_end IS NULL OR current_period_start IS NULL OR current_period_end > current_period_start
  )
);

-- At most one live subscription per subscriber.
CREATE UNIQUE INDEX IF NOT EXISTS uq_subscriptions_live
  ON public.subscriptions ((COALESCE(user_id, agency_id)))
  WHERE status IN ('trialing', 'active', 'past_due');
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_agency ON public.subscriptions (agency_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON public.subscriptions (current_period_end)
  WHERE status IN ('trialing', 'active', 'past_due');

-- =====================================================
-- 4. Payments & invoices
-- =====================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  agency_id UUID REFERENCES public.agencies(id) ON DELETE SET NULL,
  purpose public.payment_purpose NOT NULL,
  reference_id UUID,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'HTG',
  provider TEXT NOT NULL CHECK (provider IN ('moncash', 'card', 'manual', 'simulated', 'credit')),
  provider_reference TEXT,
  provider_payload JSONB,
  status public.payment_status NOT NULL DEFAULT 'pending',
  idempotency_key TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::TEXT,
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  failure_reason TEXT,
  confirmed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  confirmed_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '2 hours',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A provider transaction can confirm only one payment (replay protection).
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_provider_reference
  ON public.payments (provider, provider_reference) WHERE provider_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_user ON public.payments (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_agency ON public.payments (agency_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_reference ON public.payments (purpose, reference_id);

CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq;

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL UNIQUE REFERENCES public.payments(id) ON DELETE RESTRICT,
  number TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  agency_id UUID REFERENCES public.agencies(id) ON DELETE SET NULL,
  billing_name TEXT,
  billing_email TEXT,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'refunded')),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_user ON public.invoices (user_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_agency ON public.invoices (agency_id, issued_at DESC);

-- =====================================================
-- 5. Promotions: offers + purchased promotions
-- =====================================================
CREATE TABLE IF NOT EXISTS public.promotion_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind public.promotion_kind NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  duration_days INTEGER NOT NULL CHECK (duration_days BETWEEN 1 AND 365),
  price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  currency TEXT NOT NULL DEFAULT 'HTG' CHECK (currency IN ('HTG', 'USD')),
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (kind, duration_days)
);

CREATE TABLE IF NOT EXISTS public.listing_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind public.promotion_kind NOT NULL,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  purchased_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  agency_id UUID REFERENCES public.agencies(id) ON DELETE SET NULL,
  offer_id UUID REFERENCES public.promotion_offers(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  duration_days INTEGER NOT NULL CHECK (duration_days BETWEEN 1 AND 365),
  price_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'HTG',
  status public.promotion_status NOT NULL DEFAULT 'pending_payment',
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT listing_promotions_dates CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_listing_promotions_property ON public.listing_promotions (property_id, kind, status);
CREATE INDEX IF NOT EXISTS idx_listing_promotions_ends ON public.listing_promotions (ends_at) WHERE status IN ('active', 'scheduled');
CREATE INDEX IF NOT EXISTS idx_listing_promotions_buyer ON public.listing_promotions (purchased_by, created_at DESC);

-- Named entities requested by the specification (RLS of the base table applies).
CREATE OR REPLACE VIEW public.sponsored_listings WITH (security_invoker = true) AS
  SELECT * FROM public.listing_promotions WHERE kind = 'sponsored';
CREATE OR REPLACE VIEW public.premium_listings WITH (security_invoker = true) AS
  SELECT * FROM public.listing_promotions WHERE kind = 'premium';

-- =====================================================
-- 6. Real-estate services
-- =====================================================
CREATE TABLE IF NOT EXISTS public.service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name TEXT NOT NULL,
  short_description TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT,
  deliverables JSONB NOT NULL DEFAULT '[]'::JSONB CHECK (jsonb_typeof(deliverables) = 'array'),
  starting_price NUMERIC(12,2) CHECK (starting_price IS NULL OR starting_price >= 0),
  currency TEXT NOT NULL DEFAULT 'HTG',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.service_categories(id) ON DELETE RESTRICT,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 120),
  email TEXT NOT NULL CHECK (char_length(email) <= 254 AND email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
  phone TEXT NOT NULL CHECK (char_length(phone) BETWEEN 6 AND 30),
  city TEXT CHECK (city IS NULL OR char_length(city) <= 80),
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 10 AND 3000),
  preferred_contact TEXT NOT NULL DEFAULT 'phone' CHECK (preferred_contact IN ('phone', 'email', 'whatsapp')),
  status public.service_request_status NOT NULL DEFAULT 'new',
  admin_notes TEXT,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_requests_status ON public.service_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_requests_user ON public.service_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_email ON public.service_requests (lower(email), created_at DESC);

-- =====================================================
-- 7. Advertising
-- =====================================================
CREATE TABLE IF NOT EXISTS public.advertising_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_name TEXT NOT NULL CHECK (char_length(advertiser_name) BETWEEN 2 AND 120),
  advertiser_sector TEXT NOT NULL CHECK (advertiser_sector IN (
    'construction', 'architecture', 'materials', 'developer', 'finance', 'insurance', 'real_estate_services', 'other'
  )),
  advertiser_contact TEXT,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 2 AND 120),
  image_url TEXT NOT NULL CHECK (image_url ~ '^https://'),
  target_url TEXT NOT NULL CHECK (target_url ~ '^https://'),
  alt_text TEXT,
  placement public.ad_placement NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  priority INTEGER NOT NULL DEFAULT 0,
  budget_amount NUMERIC(12,2) CHECK (budget_amount IS NULL OR budget_amount >= 0),
  currency TEXT NOT NULL DEFAULT 'HTG',
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  impressions_count BIGINT NOT NULL DEFAULT 0,
  clicks_count BIGINT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT advertising_campaigns_dates CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_ad_campaigns_live ON public.advertising_campaigns (placement, priority DESC)
  WHERE is_active;

CREATE TABLE IF NOT EXISTS public.advertising_impressions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.advertising_campaigns(id) ON DELETE CASCADE,
  session_hash TEXT,
  page_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.advertising_clicks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.advertising_campaigns(id) ON DELETE CASCADE,
  session_hash TEXT,
  page_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_impressions_campaign ON public.advertising_impressions (campaign_id, session_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_clicks_campaign ON public.advertising_clicks (campaign_id, session_hash, created_at DESC);

-- Public, non-sensitive projection of the campaigns currently on air.
CREATE OR REPLACE VIEW public.active_ad_campaigns
WITH (security_barrier = true, security_invoker = false)
AS
SELECT c.id, c.title, c.image_url, c.target_url, c.alt_text, c.placement, c.priority, c.advertiser_name
FROM public.advertising_campaigns AS c
WHERE c.is_active AND NOW() >= c.starts_at AND NOW() < c.ends_at;

REVOKE ALL ON public.active_ad_campaigns FROM PUBLIC;
GRANT SELECT ON public.active_ad_campaigns TO anon, authenticated;

-- =====================================================
-- 8. updated_at triggers
-- =====================================================
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['subscription_plans', 'subscriptions', 'payments', 'promotion_offers',
                           'listing_promotions', 'service_categories', 'service_requests', 'advertising_campaigns']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS update_%1$s_updated_at ON public.%1$I', t);
    EXECUTE format('CREATE TRIGGER update_%1$s_updated_at BEFORE UPDATE ON public.%1$I
                    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at()', t);
  END LOOP;
END $$;

-- =====================================================
-- 9. RLS
-- =====================================================
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advertising_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advertising_impressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advertising_clicks ENABLE ROW LEVEL SECURITY;

-- Catalogue tables: public reads active rows, admins manage everything.
DROP POLICY IF EXISTS "plans_select" ON public.subscription_plans;
CREATE POLICY "plans_select" ON public.subscription_plans
  FOR SELECT USING ((is_active AND is_public) OR public.is_admin());
DROP POLICY IF EXISTS "plans_admin_write" ON public.subscription_plans;
CREATE POLICY "plans_admin_write" ON public.subscription_plans
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "offers_select" ON public.promotion_offers;
CREATE POLICY "offers_select" ON public.promotion_offers
  FOR SELECT USING (is_active OR public.is_admin());
DROP POLICY IF EXISTS "offers_admin_write" ON public.promotion_offers;
CREATE POLICY "offers_admin_write" ON public.promotion_offers
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "service_categories_select" ON public.service_categories;
CREATE POLICY "service_categories_select" ON public.service_categories
  FOR SELECT USING (is_active OR public.is_admin());
DROP POLICY IF EXISTS "service_categories_admin_write" ON public.service_categories;
CREATE POLICY "service_categories_admin_write" ON public.service_categories
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Private financial data: read-only for the subscriber, no client writes.
DROP POLICY IF EXISTS "subscriptions_select" ON public.subscriptions;
CREATE POLICY "subscriptions_select" ON public.subscriptions
  FOR SELECT USING (
    user_id = auth.uid() OR public.has_agency_permission(agency_id, 'billing') OR public.is_admin()
  );

DROP POLICY IF EXISTS "payments_select" ON public.payments;
CREATE POLICY "payments_select" ON public.payments
  FOR SELECT USING (
    user_id = auth.uid() OR public.has_agency_permission(agency_id, 'billing') OR public.is_admin()
  );

DROP POLICY IF EXISTS "invoices_select" ON public.invoices;
CREATE POLICY "invoices_select" ON public.invoices
  FOR SELECT USING (
    user_id = auth.uid() OR public.has_agency_permission(agency_id, 'billing') OR public.is_admin()
  );

DROP POLICY IF EXISTS "listing_promotions_select" ON public.listing_promotions;
CREATE POLICY "listing_promotions_select" ON public.listing_promotions
  FOR SELECT USING (
    purchased_by = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.properties AS p
      WHERE p.id = property_id
        AND (p.owner_id = auth.uid() OR (p.agency_id IS NOT NULL AND public.is_agency_member(p.agency_id)))
    )
  );

DROP POLICY IF EXISTS "service_requests_select" ON public.service_requests;
CREATE POLICY "service_requests_select" ON public.service_requests
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "service_requests_admin_update" ON public.service_requests;
CREATE POLICY "service_requests_admin_update" ON public.service_requests
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "ad_campaigns_admin" ON public.advertising_campaigns;
CREATE POLICY "ad_campaigns_admin" ON public.advertising_campaigns
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "ad_impressions_admin" ON public.advertising_impressions;
CREATE POLICY "ad_impressions_admin" ON public.advertising_impressions
  FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "ad_clicks_admin" ON public.advertising_clicks;
CREATE POLICY "ad_clicks_admin" ON public.advertising_clicks
  FOR SELECT USING (public.is_admin());

-- Ad counters are only changed by track_ad_event().
CREATE OR REPLACE FUNCTION public.protect_ad_counters()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('postgres', 'service_role', 'supabase_admin') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.impressions_count := 0;
    NEW.clicks_count := 0;
    NEW.created_by := auth.uid();
  ELSIF NEW.impressions_count IS DISTINCT FROM OLD.impressions_count
        OR NEW.clicks_count IS DISTINCT FROM OLD.clicks_count THEN
    RAISE EXCEPTION 'Compteurs non modifiables' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_ad_counters ON public.advertising_campaigns;
CREATE TRIGGER protect_ad_counters
  BEFORE INSERT OR UPDATE ON public.advertising_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.protect_ad_counters();

-- =====================================================
-- 10. Subscription helpers & listing quotas
-- =====================================================
CREATE OR REPLACE FUNCTION public.billing_interval(p_cycle public.billing_cycle)
RETURNS INTERVAL
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE p_cycle WHEN 'yearly' THEN INTERVAL '1 year' ELSE INTERVAL '1 month' END;
$$;

-- Live = paid or trial period still running.
CREATE OR REPLACE FUNCTION public.live_subscription_id(p_user_id UUID, p_agency_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT s.id
  FROM public.subscriptions AS s
  WHERE ((p_agency_id IS NOT NULL AND s.agency_id = p_agency_id)
         OR (p_agency_id IS NULL AND s.user_id = p_user_id))
    AND s.status IN ('trialing', 'active', 'past_due')
    AND s.current_period_end > NOW()
  ORDER BY s.current_period_end DESC
  LIMIT 1;
$$;

-- Returns the listing limit; NULL means unlimited.
CREATE OR REPLACE FUNCTION public.listing_quota(p_owner_id UUID, p_agency_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_sub_id UUID := public.live_subscription_id(p_owner_id, p_agency_id);
  v_limit INTEGER;
BEGIN
  IF v_sub_id IS NOT NULL THEN
    SELECT p.max_active_listings INTO v_limit
    FROM public.subscriptions AS s JOIN public.subscription_plans AS p ON p.id = s.plan_id
    WHERE s.id = v_sub_id;
    RETURN v_limit;
  END IF;

  IF p_agency_id IS NOT NULL THEN
    RETURN public.setting_int('free_agency_listing_limit', 5);
  END IF;
  RETURN public.setting_int('free_owner_listing_limit', 3);
END;
$$;

CREATE OR REPLACE FUNCTION public.listing_usage(p_owner_id UUID, p_agency_id UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT count(*)::INTEGER
  FROM public.properties AS p
  WHERE p.status IN ('pending', 'active')
    AND ((p_agency_id IS NOT NULL AND p.agency_id = p_agency_id)
         OR (p_agency_id IS NULL AND p.owner_id = p_owner_id AND p.agency_id IS NULL));
$$;

CREATE OR REPLACE FUNCTION public.agency_member_limit(p_agency_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_sub_id UUID := public.live_subscription_id(NULL, p_agency_id);
  v_limit INTEGER;
BEGIN
  IF v_sub_id IS NULL THEN
    RETURN public.setting_int('free_agency_member_limit', 1);
  END IF;
  SELECT p.max_members INTO v_limit
  FROM public.subscriptions AS s JOIN public.subscription_plans AS p ON p.id = s.plan_id
  WHERE s.id = v_sub_id;
  RETURN v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.live_subscription_id(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.listing_quota(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.listing_usage(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agency_member_limit(UUID) FROM PUBLIC, anon, authenticated;

INSERT INTO public.site_settings (key, value, description) VALUES
  ('free_agency_member_limit', '1', 'Membres d''agence autorisés sans abonnement'),
  ('credit_boost_days', '7', 'Durée (jours) d''une mise en avant obtenue avec un crédit d''abonnement')
ON CONFLICT (key) DO NOTHING;

-- Enforce the plan limit when a listing is created or moved into an agency.
CREATE OR REPLACE FUNCTION public.enforce_listing_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_limit INTEGER;
  v_used INTEGER;
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.agency_id IS NOT DISTINCT FROM OLD.agency_id THEN
    RETURN NEW;
  END IF;

  v_limit := public.listing_quota(NEW.owner_id, NEW.agency_id);
  IF v_limit IS NULL THEN
    RETURN NEW;
  END IF;

  v_used := public.listing_usage(NEW.owner_id, NEW.agency_id);
  IF v_used + 1 > v_limit THEN
    RAISE EXCEPTION 'Limite de % annonce(s) atteinte pour votre formule. Passez à une formule supérieure pour publier davantage.', v_limit
      USING ERRCODE = 'P0001', HINT = 'quota_exceeded';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_listing_quota() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_listing_quota ON public.properties;
CREATE TRIGGER enforce_listing_quota
  BEFORE INSERT OR UPDATE OF agency_id ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.enforce_listing_quota();

-- Quota + subscription summary for the dashboards.
CREATE OR REPLACE FUNCTION public.get_my_quota(p_agency_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_sub_id UUID;
  v_result JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise' USING ERRCODE = '42501';
  END IF;
  IF p_agency_id IS NOT NULL AND NOT (public.is_agency_member(p_agency_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;

  v_sub_id := public.live_subscription_id(auth.uid(), p_agency_id);

  SELECT jsonb_build_object(
    'limit', public.listing_quota(auth.uid(), p_agency_id),
    'used', public.listing_usage(auth.uid(), p_agency_id),
    'member_limit', CASE WHEN p_agency_id IS NULL THEN NULL ELSE public.agency_member_limit(p_agency_id) END,
    'subscription_id', v_sub_id,
    'plan_code', (SELECT p.code FROM public.subscriptions s JOIN public.subscription_plans p ON p.id = s.plan_id WHERE s.id = v_sub_id),
    'plan_name', (SELECT p.name FROM public.subscriptions s JOIN public.subscription_plans p ON p.id = s.plan_id WHERE s.id = v_sub_id),
    'capabilities', COALESCE((SELECT p.capabilities FROM public.subscriptions s JOIN public.subscription_plans p ON p.id = s.plan_id WHERE s.id = v_sub_id), '{}'::JSONB),
    'featured_credits', COALESCE((SELECT s.featured_credits_remaining FROM public.subscriptions s WHERE s.id = v_sub_id), 0)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_quota(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_quota(UUID) TO authenticated;

-- =====================================================
-- 11. Promotions: refresh / activation
-- =====================================================
CREATE OR REPLACE FUNCTION public.refresh_property_promotions(p_property_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.properties AS p
  SET sponsored_until = (
        SELECT max(lp.ends_at) FROM public.listing_promotions AS lp
        WHERE lp.property_id = p.id AND lp.kind = 'sponsored'
          AND lp.status IN ('active', 'scheduled') AND lp.ends_at > NOW()),
      premium_until = (
        SELECT max(lp.ends_at) FROM public.listing_promotions AS lp
        WHERE lp.property_id = p.id AND lp.kind = 'premium'
          AND lp.status IN ('active', 'scheduled') AND lp.ends_at > NOW())
  WHERE p.id = p_property_id;
END;
$$;

-- Promotions stack: a new one starts when the current one ends.
CREATE OR REPLACE FUNCTION public.activate_promotion(p_promotion_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_promo public.listing_promotions%ROWTYPE;
  v_start TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_promo FROM public.listing_promotions WHERE id = p_promotion_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Promotion introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF v_promo.status <> 'pending_payment' THEN
    RETURN; -- idempotent
  END IF;

  SELECT GREATEST(NOW(), COALESCE(max(lp.ends_at), NOW())) INTO v_start
  FROM public.listing_promotions AS lp
  WHERE lp.property_id = v_promo.property_id AND lp.kind = v_promo.kind
    AND lp.status IN ('active', 'scheduled') AND lp.id <> v_promo.id;

  UPDATE public.listing_promotions
  SET starts_at = v_start,
      ends_at = v_start + make_interval(days => v_promo.duration_days),
      status = CASE WHEN v_start > NOW() THEN 'scheduled'::public.promotion_status ELSE 'active'::public.promotion_status END
  WHERE id = v_promo.id;

  PERFORM public.refresh_property_promotions(v_promo.property_id);
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_property_promotions(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.activate_promotion(UUID) FROM PUBLIC, anon, authenticated;

-- =====================================================
-- 12. Payment core (internal)
-- =====================================================
CREATE OR REPLACE FUNCTION public.assert_payment_provider(p_provider TEXT)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
BEGIN
  IF p_provider NOT IN ('moncash', 'card', 'manual', 'simulated') THEN
    RAISE EXCEPTION 'Moyen de paiement non pris en charge' USING ERRCODE = '22023';
  END IF;
  IF p_provider = 'simulated' AND NOT public.setting_bool('payments_simulation_enabled', FALSE) THEN
    RAISE EXCEPTION 'Le paiement simulé est désactivé' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_pending_payment(
  p_purpose public.payment_purpose,
  p_reference_id UUID,
  p_amount NUMERIC,
  p_currency TEXT,
  p_provider TEXT,
  p_agency_id UUID,
  p_description TEXT,
  p_metadata JSONB
)
RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_payment public.payments;
BEGIN
  PERFORM public.assert_payment_provider(p_provider);

  -- Duplicate prevention: reuse an open checkout for the same object.
  SELECT * INTO v_payment FROM public.payments
  WHERE user_id = auth.uid() AND purpose = p_purpose AND reference_id = p_reference_id
    AND provider = p_provider AND status = 'pending' AND expires_at > NOW()
  ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN
    RETURN v_payment;
  END IF;

  INSERT INTO public.payments (user_id, agency_id, purpose, reference_id, amount, currency, provider,
                               description, metadata, expires_at)
  VALUES (auth.uid(), p_agency_id, p_purpose, p_reference_id, round(p_amount, 2), p_currency, p_provider,
          p_description, COALESCE(p_metadata, '{}'::JSONB),
          NOW() + make_interval(mins => public.setting_int('payment_checkout_ttl_minutes', 120)))
  RETURNING * INTO v_payment;

  RETURN v_payment;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_payment_provider(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_pending_payment(public.payment_purpose, UUID, NUMERIC, TEXT, TEXT, UUID, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fulfill_payment(p_payment_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_sub public.subscriptions%ROWTYPE;
  v_credits INTEGER;
BEGIN
  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id;

  IF v_payment.purpose = 'subscription' THEN
    SELECT * INTO v_sub FROM public.subscriptions WHERE id = v_payment.reference_id FOR UPDATE;
    SELECT featured_credits_per_period INTO v_credits FROM public.subscription_plans WHERE id = v_sub.plan_id;

    -- Plan change: the previous live subscription ends now (credit was prorated at checkout).
    UPDATE public.subscriptions
    SET status = 'cancelled', cancelled_at = NOW(), cancel_at_period_end = FALSE
    WHERE id <> v_sub.id
      AND COALESCE(user_id, agency_id) = COALESCE(v_sub.user_id, v_sub.agency_id)
      AND status IN ('trialing', 'active', 'past_due');

    UPDATE public.subscriptions
    SET status = 'active',
        current_period_start = NOW(),
        current_period_end = NOW() + public.billing_interval(v_sub.billing_cycle),
        cancel_at_period_end = FALSE,
        cancelled_at = NULL,
        featured_credits_remaining = COALESCE(v_credits, 0)
    WHERE id = v_sub.id;

  ELSIF v_payment.purpose = 'subscription_renewal' THEN
    SELECT * INTO v_sub FROM public.subscriptions WHERE id = v_payment.reference_id FOR UPDATE;
    SELECT featured_credits_per_period INTO v_credits FROM public.subscription_plans WHERE id = v_sub.plan_id;

    UPDATE public.subscriptions
    SET status = 'active',
        current_period_start = CASE WHEN current_period_end IS NULL OR current_period_end < NOW()
                                    THEN NOW() ELSE current_period_start END,
        current_period_end = GREATEST(NOW(), COALESCE(current_period_end, NOW()))
                             + public.billing_interval(billing_cycle),
        cancel_at_period_end = FALSE,
        cancelled_at = NULL,
        featured_credits_remaining = featured_credits_remaining + COALESCE(v_credits, 0)
    WHERE id = v_sub.id;

  ELSIF v_payment.purpose IN ('sponsored_listing', 'premium_listing') THEN
    PERFORM public.activate_promotion(v_payment.reference_id);
  END IF;
  -- 'service' and 'advertising' payments are reconciled manually by admins.
END;
$$;

CREATE OR REPLACE FUNCTION public.issue_invoice(p_payment_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.invoices (payment_id, number, user_id, agency_id, billing_name, billing_email,
                               description, amount, currency)
  SELECT pay.id,
         'CI-' || to_char(NOW(), 'YYYY') || '-' || lpad(nextval('public.invoice_number_seq')::TEXT, 6, '0'),
         pay.user_id, pay.agency_id,
         COALESCE(ag.name, trim(pr.first_name || ' ' || pr.last_name)),
         COALESCE(ag.email, pr.email),
         COALESCE(pay.description, pay.purpose::TEXT), pay.amount, pay.currency
  FROM public.payments AS pay
  LEFT JOIN public.profiles AS pr ON pr.id = pay.user_id
  LEFT JOIN public.agencies AS ag ON ag.id = pay.agency_id
  WHERE pay.id = p_payment_id
  ON CONFLICT (payment_id) DO NOTHING;
END;
$$;

-- Single confirmation path, shared by the provider callback and admins.
CREATE OR REPLACE FUNCTION public.confirm_payment_internal(
  p_payment_id UUID,
  p_provider_reference TEXT,
  p_paid_amount NUMERIC,
  p_payload JSONB,
  p_confirmed_by UUID
)
RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_payment public.payments;
BEGIN
  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction introuvable' USING ERRCODE = 'P0002';
  END IF;

  IF v_payment.status = 'succeeded' THEN
    RETURN v_payment; -- idempotent: webhook retries, double clicks
  END IF;
  IF v_payment.status NOT IN ('pending', 'failed') THEN
    RAISE EXCEPTION 'Transaction non confirmable (statut %)', v_payment.status USING ERRCODE = 'P0001';
  END IF;

  IF p_paid_amount IS NULL OR p_paid_amount < v_payment.amount THEN
    UPDATE public.payments
    SET status = 'failed', failure_reason = 'amount_mismatch', provider_payload = p_payload
    WHERE id = p_payment_id
    RETURNING * INTO v_payment;
    RETURN v_payment;
  END IF;

  UPDATE public.payments
  SET status = 'succeeded',
      provider_reference = COALESCE(p_provider_reference, provider_reference),
      provider_payload = p_payload,
      failure_reason = NULL,
      confirmed_by = p_confirmed_by,
      confirmed_at = NOW()
  WHERE id = p_payment_id
  RETURNING * INTO v_payment;

  PERFORM public.fulfill_payment(p_payment_id);
  PERFORM public.issue_invoice(p_payment_id);

  IF v_payment.user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (v_payment.user_id, 'system', 'Paiement confirmé',
            format('Votre paiement de %s %s a été confirmé.', v_payment.amount, v_payment.currency),
            '/dashboard/paiements');
  END IF;

  RETURN v_payment;
END;
$$;

REVOKE ALL ON FUNCTION public.fulfill_payment(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.issue_invoice(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_payment_internal(UUID, TEXT, NUMERIC, JSONB, UUID) FROM PUBLIC, anon, authenticated;

-- Provider callback (service_role only: Edge Function after server-side verification).
CREATE OR REPLACE FUNCTION public.confirm_payment(
  p_payment_id UUID,
  p_provider_reference TEXT,
  p_paid_amount NUMERIC,
  p_payload JSONB DEFAULT '{}'::JSONB
)
RETURNS public.payments
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT * FROM public.confirm_payment_internal(p_payment_id, p_provider_reference, p_paid_amount, p_payload, NULL);
$$;

CREATE OR REPLACE FUNCTION public.fail_payment(p_payment_id UUID, p_reason TEXT, p_payload JSONB DEFAULT '{}'::JSONB)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.payments
  SET status = 'failed', failure_reason = left(p_reason, 200), provider_payload = p_payload
  WHERE id = p_payment_id AND status = 'pending';
$$;

REVOKE ALL ON FUNCTION public.confirm_payment(UUID, TEXT, NUMERIC, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_payment(UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_payment(UUID, TEXT, NUMERIC, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_payment(UUID, TEXT, JSONB) TO service_role;

-- Payer can abandon an open checkout.
CREATE OR REPLACE FUNCTION public.cancel_my_payment(p_payment_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
BEGIN
  UPDATE public.payments SET status = 'cancelled'
  WHERE id = p_payment_id AND user_id = auth.uid() AND status = 'pending'
  RETURNING * INTO v_payment;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction introuvable ou déjà traitée' USING ERRCODE = 'P0002';
  END IF;

  IF v_payment.purpose = 'subscription' THEN
    UPDATE public.subscriptions SET status = 'cancelled', cancelled_at = NOW()
    WHERE id = v_payment.reference_id AND status = 'pending_payment';
  ELSIF v_payment.purpose IN ('sponsored_listing', 'premium_listing') THEN
    UPDATE public.listing_promotions SET status = 'cancelled'
    WHERE id = v_payment.reference_id AND status = 'pending_payment';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_my_payment(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_my_payment(UUID) TO authenticated;

-- =====================================================
-- 13. Checkout RPCs (amount always computed server-side)
-- =====================================================
CREATE OR REPLACE FUNCTION public.assert_subscriber_access(p_agency_id UUID)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise' USING ERRCODE = '42501';
  END IF;
  IF p_agency_id IS NOT NULL AND NOT public.has_agency_permission(p_agency_id, 'billing') THEN
    RAISE EXCEPTION 'Vous n''êtes pas autorisé à gérer la facturation de cette agence' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_subscriber_access(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.checkout_subscription(
  p_plan_id UUID,
  p_cycle public.billing_cycle,
  p_provider TEXT,
  p_agency_id UUID DEFAULT NULL
)
RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_plan public.subscription_plans%ROWTYPE;
  v_live public.subscriptions%ROWTYPE;
  v_sub_id UUID;
  v_price NUMERIC;
  v_credit NUMERIC := 0;
  v_amount NUMERIC;
  v_payment public.payments;
  v_user_id UUID := CASE WHEN p_agency_id IS NULL THEN auth.uid() END;
BEGIN
  PERFORM public.assert_subscriber_access(p_agency_id);

  SELECT * INTO v_plan FROM public.subscription_plans WHERE id = p_plan_id AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Formule indisponible' USING ERRCODE = 'P0002';
  END IF;
  IF (p_agency_id IS NULL AND v_plan.audience = 'agency') OR (p_agency_id IS NOT NULL AND v_plan.audience = 'owner') THEN
    RAISE EXCEPTION 'Cette formule ne correspond pas à votre type de compte' USING ERRCODE = 'P0001';
  END IF;

  v_price := CASE p_cycle WHEN 'yearly' THEN v_plan.price_yearly ELSE v_plan.price_monthly END;
  IF v_price <= 0 THEN
    RAISE EXCEPTION 'Tarif non configuré pour cette formule' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_live FROM public.subscriptions
  WHERE id = public.live_subscription_id(v_user_id, p_agency_id);
  IF FOUND THEN
    IF v_live.plan_id = p_plan_id AND v_live.billing_cycle = p_cycle THEN
      RAISE EXCEPTION 'Vous avez déjà cette formule. Utilisez le renouvellement.' USING ERRCODE = 'P0001';
    END IF;
    -- Prorated credit for the unused part of a PAID period.
    IF v_live.status = 'active' AND v_live.current_period_start IS NOT NULL THEN
      v_credit := round(
        v_live.price_amount
        * GREATEST(EXTRACT(EPOCH FROM (v_live.current_period_end - NOW())), 0)
        / NULLIF(EXTRACT(EPOCH FROM (v_live.current_period_end - v_live.current_period_start)), 0), 2);
    END IF;
  END IF;
  v_amount := GREATEST(v_price - COALESCE(v_credit, 0), 0);

  -- Reuse an open checkout for the same plan/cycle.
  SELECT s.id INTO v_sub_id FROM public.subscriptions AS s
  WHERE s.status = 'pending_payment' AND s.plan_id = p_plan_id AND s.billing_cycle = p_cycle
    AND ((p_agency_id IS NULL AND s.user_id = auth.uid()) OR s.agency_id = p_agency_id)
    AND EXISTS (SELECT 1 FROM public.payments AS pay
                WHERE pay.reference_id = s.id AND pay.status = 'pending' AND pay.expires_at > NOW()
                  AND pay.provider = p_provider)
  ORDER BY s.created_at DESC LIMIT 1;

  IF v_sub_id IS NULL THEN
    INSERT INTO public.subscriptions (plan_id, user_id, agency_id, billing_cycle, status, price_amount, currency, created_by)
    VALUES (p_plan_id, v_user_id, p_agency_id, p_cycle, 'pending_payment', v_price, v_plan.currency, auth.uid())
    RETURNING id INTO v_sub_id;
  END IF;

  IF v_amount = 0 THEN
    -- Fully covered by the prorated credit: confirm immediately, no money moves.
    INSERT INTO public.payments (user_id, agency_id, purpose, reference_id, amount, currency, provider, description, metadata)
    VALUES (auth.uid(), p_agency_id, 'subscription', v_sub_id, 0, v_plan.currency, 'credit',
            format('Changement de formule : %s (%s)', v_plan.name, p_cycle),
            jsonb_build_object('plan_id', p_plan_id, 'cycle', p_cycle, 'proration_credit', v_credit))
    RETURNING * INTO v_payment;
    RETURN public.confirm_payment_internal(v_payment.id, 'credit-' || v_payment.id, 0, '{}'::JSONB, auth.uid());
  END IF;

  RETURN public.create_pending_payment(
    'subscription', v_sub_id, v_amount, v_plan.currency, p_provider, p_agency_id,
    format('Abonnement %s (%s)', v_plan.name, CASE p_cycle WHEN 'yearly' THEN 'annuel' ELSE 'mensuel' END),
    jsonb_build_object('plan_id', p_plan_id, 'cycle', p_cycle, 'list_price', v_price, 'proration_credit', v_credit)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.checkout_subscription_renewal(p_subscription_id UUID, p_provider TEXT)
RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_sub public.subscriptions%ROWTYPE;
  v_plan public.subscription_plans%ROWTYPE;
  v_price NUMERIC;
  v_other UUID;
BEGIN
  SELECT * INTO v_sub FROM public.subscriptions WHERE id = p_subscription_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Abonnement introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF v_sub.user_id IS NOT NULL AND v_sub.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;
  PERFORM public.assert_subscriber_access(v_sub.agency_id);

  IF v_sub.status NOT IN ('active', 'trialing', 'past_due', 'expired') THEN
    RAISE EXCEPTION 'Cet abonnement ne peut pas être renouvelé' USING ERRCODE = 'P0001';
  END IF;
  v_other := public.live_subscription_id(v_sub.user_id, v_sub.agency_id);
  IF v_other IS NOT NULL AND v_other <> v_sub.id THEN
    RAISE EXCEPTION 'Un autre abonnement est actif' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_plan FROM public.subscription_plans WHERE id = v_sub.plan_id AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cette formule n''est plus proposée. Choisissez une nouvelle formule.' USING ERRCODE = 'P0001';
  END IF;
  v_price := CASE v_sub.billing_cycle WHEN 'yearly' THEN v_plan.price_yearly ELSE v_plan.price_monthly END;
  IF v_price <= 0 THEN
    RAISE EXCEPTION 'Tarif non configuré pour cette formule' USING ERRCODE = 'P0001';
  END IF;

  RETURN public.create_pending_payment(
    'subscription_renewal', v_sub.id, v_price, v_plan.currency, p_provider, v_sub.agency_id,
    format('Renouvellement %s', v_plan.name),
    jsonb_build_object('plan_id', v_plan.id, 'cycle', v_sub.billing_cycle)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.checkout_promotion(
  p_kind public.promotion_kind,
  p_property_id UUID,
  p_offer_id UUID,
  p_provider TEXT
)
RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_property public.properties%ROWTYPE;
  v_offer public.promotion_offers%ROWTYPE;
  v_promo_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_property FROM public.properties WHERE id = p_property_id;
  IF NOT FOUND OR NOT ((v_property.owner_id = auth.uid() AND v_property.agency_id IS NULL)
                       OR public.has_agency_permission(v_property.agency_id, 'publish')) THEN
    RAISE EXCEPTION 'Annonce introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF NOT (v_property.is_published AND v_property.status = 'active') THEN
    RAISE EXCEPTION 'Seules les annonces en ligne peuvent être mises en avant' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_offer FROM public.promotion_offers WHERE id = p_offer_id AND kind = p_kind AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Offre indisponible' USING ERRCODE = 'P0002';
  END IF;
  IF v_offer.price <= 0 THEN
    RAISE EXCEPTION 'Tarif non configuré pour cette offre' USING ERRCODE = 'P0001';
  END IF;

  SELECT lp.id INTO v_promo_id FROM public.listing_promotions AS lp
  WHERE lp.property_id = p_property_id AND lp.offer_id = p_offer_id AND lp.status = 'pending_payment'
    AND lp.purchased_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.payments AS pay
                WHERE pay.reference_id = lp.id AND pay.status = 'pending' AND pay.expires_at > NOW()
                  AND pay.provider = p_provider)
  LIMIT 1;

  IF v_promo_id IS NULL THEN
    INSERT INTO public.listing_promotions (kind, property_id, purchased_by, agency_id, offer_id, duration_days, price_paid, currency)
    VALUES (p_kind, p_property_id, auth.uid(), v_property.agency_id, p_offer_id, v_offer.duration_days, v_offer.price, v_offer.currency)
    RETURNING id INTO v_promo_id;
  END IF;

  RETURN public.create_pending_payment(
    CASE p_kind WHEN 'sponsored' THEN 'sponsored_listing'::public.payment_purpose ELSE 'premium_listing'::public.payment_purpose END,
    v_promo_id, v_offer.price, v_offer.currency, p_provider, v_property.agency_id,
    format('%s %s jours — %s', CASE p_kind WHEN 'sponsored' THEN 'Sponsorisation' ELSE 'Option Premium' END,
           v_offer.duration_days, left(v_property.title, 80)),
    jsonb_build_object('offer_id', p_offer_id, 'property_id', p_property_id, 'kind', p_kind)
  );
END;
$$;

-- Free trial (only once per subscriber, only if the plan offers one).
CREATE OR REPLACE FUNCTION public.start_subscription_trial(
  p_plan_id UUID,
  p_cycle public.billing_cycle,
  p_agency_id UUID DEFAULT NULL
)
RETURNS public.subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_plan public.subscription_plans%ROWTYPE;
  v_sub public.subscriptions;
  v_user_id UUID := CASE WHEN p_agency_id IS NULL THEN auth.uid() END;
BEGIN
  PERFORM public.assert_subscriber_access(p_agency_id);

  SELECT * INTO v_plan FROM public.subscription_plans WHERE id = p_plan_id AND is_active AND trial_days > 0;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aucune période d''essai pour cette formule' USING ERRCODE = 'P0001';
  END IF;
  IF (p_agency_id IS NULL AND v_plan.audience = 'agency') OR (p_agency_id IS NOT NULL AND v_plan.audience = 'owner') THEN
    RAISE EXCEPTION 'Cette formule ne correspond pas à votre type de compte' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE ((p_agency_id IS NULL AND user_id = auth.uid()) OR agency_id = p_agency_id)
      AND status <> 'pending_payment'
  ) THEN
    RAISE EXCEPTION 'La période d''essai est réservée aux nouveaux abonnés' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.subscriptions (plan_id, user_id, agency_id, billing_cycle, status, price_amount, currency,
                                    trial_ends_at, current_period_start, current_period_end, created_by)
  VALUES (p_plan_id, v_user_id, p_agency_id, p_cycle, 'trialing',
          CASE p_cycle WHEN 'yearly' THEN v_plan.price_yearly ELSE v_plan.price_monthly END, v_plan.currency,
          NOW() + make_interval(days => v_plan.trial_days), NOW(), NOW() + make_interval(days => v_plan.trial_days),
          auth.uid())
  RETURNING * INTO v_sub;
  RETURN v_sub;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_subscription_cancellation(p_subscription_id UUID, p_cancel BOOLEAN)
RETURNS public.subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_sub public.subscriptions;
BEGIN
  SELECT * INTO v_sub FROM public.subscriptions WHERE id = p_subscription_id;
  IF NOT FOUND OR (v_sub.user_id IS NOT NULL AND v_sub.user_id <> auth.uid()) THEN
    RAISE EXCEPTION 'Abonnement introuvable' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public.assert_subscriber_access(v_sub.agency_id);
  IF v_sub.status NOT IN ('active', 'trialing', 'past_due') THEN
    RAISE EXCEPTION 'Cet abonnement n''est pas actif' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.subscriptions
  SET cancel_at_period_end = p_cancel,
      cancelled_at = CASE WHEN p_cancel THEN NOW() ELSE NULL END
  WHERE id = p_subscription_id
  RETURNING * INTO v_sub;
  RETURN v_sub;
END;
$$;

-- Use a plan credit to sponsor a listing (Business / Enterprise).
CREATE OR REPLACE FUNCTION public.redeem_sponsored_credit(p_property_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_property public.properties%ROWTYPE;
  v_sub_id UUID;
  v_promo_id UUID;
  v_days INTEGER := public.setting_int('credit_boost_days', 7);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_property FROM public.properties WHERE id = p_property_id;
  IF NOT FOUND OR NOT ((v_property.owner_id = auth.uid() AND v_property.agency_id IS NULL)
                       OR public.has_agency_permission(v_property.agency_id, 'publish')) THEN
    RAISE EXCEPTION 'Annonce introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF NOT (v_property.is_published AND v_property.status = 'active') THEN
    RAISE EXCEPTION 'Seules les annonces en ligne peuvent être mises en avant' USING ERRCODE = 'P0001';
  END IF;

  v_sub_id := public.live_subscription_id(v_property.owner_id, v_property.agency_id);
  UPDATE public.subscriptions
  SET featured_credits_remaining = featured_credits_remaining - 1
  WHERE id = v_sub_id AND featured_credits_remaining > 0;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aucun crédit de mise en avant disponible' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.listing_promotions (kind, property_id, purchased_by, agency_id, subscription_id, duration_days, price_paid, currency)
  VALUES ('sponsored', p_property_id, auth.uid(), v_property.agency_id, v_sub_id, v_days, 0, 'HTG')
  RETURNING id INTO v_promo_id;

  PERFORM public.activate_promotion(v_promo_id);
  RETURN v_promo_id;
END;
$$;

REVOKE ALL ON FUNCTION public.checkout_subscription(UUID, public.billing_cycle, TEXT, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.checkout_subscription_renewal(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.checkout_promotion(public.promotion_kind, UUID, UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.start_subscription_trial(UUID, public.billing_cycle, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_subscription_cancellation(UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.redeem_sponsored_credit(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.checkout_subscription(UUID, public.billing_cycle, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.checkout_subscription_renewal(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.checkout_promotion(public.promotion_kind, UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_subscription_trial(UUID, public.billing_cycle, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_subscription_cancellation(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_sponsored_credit(UUID) TO authenticated;

-- =====================================================
-- 14. Service requests (visitors, rate limited)
-- =====================================================
CREATE OR REPLACE FUNCTION public.submit_service_request(
  p_category_id UUID,
  p_full_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_city TEXT,
  p_message TEXT,
  p_preferred_contact TEXT DEFAULT 'phone',
  p_property_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email TEXT := lower(trim(p_email));
  v_id UUID;
  v_category_name TEXT;
BEGIN
  SELECT name INTO v_category_name FROM public.service_categories WHERE id = p_category_id AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service indisponible' USING ERRCODE = 'P0002';
  END IF;

  IF (SELECT count(*) FROM public.service_requests
      WHERE lower(email) = v_email AND created_at > NOW() - INTERVAL '1 day') >= 5 THEN
    RAISE EXCEPTION 'Trop de demandes. Réessayez demain.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.service_requests (category_id, user_id, property_id, full_name, email, phone, city, message, preferred_contact)
  VALUES (p_category_id, auth.uid(),
          (SELECT id FROM public.properties WHERE id = p_property_id AND (owner_id = auth.uid() OR (is_published AND status = 'active'))),
          trim(p_full_name), v_email, trim(p_phone), NULLIF(trim(p_city), ''), trim(p_message), p_preferred_contact)
  RETURNING id INTO v_id;

  -- Alert administrators.
  INSERT INTO public.notifications (user_id, type, title, message, link)
  SELECT pr.id, 'system', 'Nouvelle demande de service',
         format('%s — %s', v_category_name, trim(p_full_name)), '/admin/services'
  FROM public.profiles AS pr WHERE pr.role IN ('admin', 'super_admin') AND pr.is_active;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_service_request(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_service_request(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) TO anon, authenticated;

-- =====================================================
-- 15. Advertising tracking
-- =====================================================
CREATE OR REPLACE FUNCTION public.track_ad_event(
  p_campaign_id UUID,
  p_event TEXT,
  p_session TEXT,
  p_path TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_session TEXT := left(regexp_replace(COALESCE(p_session, ''), '[^A-Za-z0-9-]', '', 'g'), 64);
BEGIN
  IF p_event NOT IN ('impression', 'click') OR v_session = '' THEN
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.active_ad_campaigns WHERE id = p_campaign_id) THEN
    RETURN;
  END IF;

  IF p_event = 'impression' THEN
    -- One impression per session and campaign every 30 minutes.
    IF EXISTS (SELECT 1 FROM public.advertising_impressions
               WHERE campaign_id = p_campaign_id AND session_hash = v_session
                 AND created_at > NOW() - INTERVAL '30 minutes') THEN
      RETURN;
    END IF;
    INSERT INTO public.advertising_impressions (campaign_id, session_hash, page_path)
    VALUES (p_campaign_id, v_session, left(p_path, 200));
    UPDATE public.advertising_campaigns SET impressions_count = impressions_count + 1 WHERE id = p_campaign_id;
  ELSE
    IF EXISTS (SELECT 1 FROM public.advertising_clicks
               WHERE campaign_id = p_campaign_id AND session_hash = v_session
                 AND created_at > NOW() - INTERVAL '10 minutes') THEN
      RETURN;
    END IF;
    INSERT INTO public.advertising_clicks (campaign_id, session_hash, page_path)
    VALUES (p_campaign_id, v_session, left(p_path, 200));
    UPDATE public.advertising_campaigns SET clicks_count = clicks_count + 1 WHERE id = p_campaign_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.track_ad_event(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_ad_event(UUID, TEXT, TEXT, TEXT) TO anon, authenticated;

-- =====================================================
-- 16. Scheduled maintenance (expirations)
-- =====================================================
CREATE OR REPLACE FUNCTION public.run_marketplace_maintenance()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_subs INTEGER;
  v_promos INTEGER;
  v_started INTEGER;
  v_payments INTEGER;
  v_property UUID;
  v_properties UUID[];
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;

  -- Subscriptions whose period is over.
  WITH ended AS (
    UPDATE public.subscriptions
    SET status = CASE WHEN cancel_at_period_end THEN 'cancelled'::public.subscription_status
                      ELSE 'expired'::public.subscription_status END
    WHERE status IN ('trialing', 'active', 'past_due') AND current_period_end <= NOW()
    RETURNING id, user_id, agency_id
  )
  SELECT count(*) INTO v_subs FROM ended;

  -- Scheduled promotions that start now.
  WITH started AS (
    UPDATE public.listing_promotions SET status = 'active'
    WHERE status = 'scheduled' AND starts_at <= NOW()
    RETURNING id
  )
  SELECT count(*) INTO v_started FROM started;

  -- Expired promotions + refresh the denormalized listing columns.
  WITH expired AS (
    UPDATE public.listing_promotions SET status = 'expired'
    WHERE status IN ('active', 'scheduled') AND ends_at <= NOW()
    RETURNING property_id
  )
  SELECT COALESCE(array_agg(DISTINCT property_id), '{}') INTO v_properties FROM expired;

  v_promos := COALESCE(array_length(v_properties, 1), 0);
  FOREACH v_property IN ARRAY v_properties
  LOOP
    PERFORM public.refresh_property_promotions(v_property);
  END LOOP;

  -- Defensive: clear stale columns even if a promotion row was removed.
  UPDATE public.properties SET sponsored_until = NULL WHERE sponsored_until IS NOT NULL AND sponsored_until <= NOW();
  UPDATE public.properties SET premium_until = NULL WHERE premium_until IS NOT NULL AND premium_until <= NOW();

  -- Abandoned checkouts.
  WITH stale AS (
    UPDATE public.payments SET status = 'cancelled', failure_reason = 'checkout_expired'
    WHERE status = 'pending' AND expires_at <= NOW()
    RETURNING purpose, reference_id
  ), subs AS (
    UPDATE public.subscriptions SET status = 'cancelled', cancelled_at = NOW()
    WHERE status = 'pending_payment' AND id IN (SELECT reference_id FROM stale WHERE purpose = 'subscription')
    RETURNING id
  ), promos AS (
    UPDATE public.listing_promotions SET status = 'cancelled'
    WHERE status = 'pending_payment'
      AND id IN (SELECT reference_id FROM stale WHERE purpose IN ('sponsored_listing', 'premium_listing'))
    RETURNING id
  )
  SELECT count(*) INTO v_payments FROM stale;

  RETURN jsonb_build_object(
    'subscriptions_ended', v_subs,
    'promotions_started', v_started,
    'properties_refreshed', v_promos,
    'checkouts_expired', v_payments,
    'ran_at', NOW()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.run_marketplace_maintenance() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_marketplace_maintenance() TO authenticated, service_role;

-- Schedule every 15 minutes when pg_cron is available (Supabase: enable it in
-- Database > Extensions). Without it, call the function from a cron job.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_cron;
      PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'ciento-marketplace-maintenance';
      PERFORM cron.schedule('ciento-marketplace-maintenance', '*/15 * * * *',
                            'SELECT public.run_marketplace_maintenance()');
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'pg_cron indisponible (%). Planifiez run_marketplace_maintenance() manuellement.', SQLERRM;
    END;
  END IF;
END $$;

-- =====================================================
-- 17. Brand assets bucket (agency logos, ad banners)
-- =====================================================
CREATE OR REPLACE FUNCTION public.can_manage_brand_object(object_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_parts TEXT[] := string_to_array(object_name, '/');
BEGIN
  IF public.is_admin() THEN
    RETURN TRUE;
  END IF;
  IF array_length(v_parts, 1) >= 3 AND v_parts[1] = 'agencies'
     AND v_parts[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN public.can_manage_agency(v_parts[2]::UUID);
  END IF;
  RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.can_manage_brand_object(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_brand_object(TEXT) TO authenticated;

DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NULL THEN
    RAISE NOTICE 'Schéma storage absent : bucket brand-assets non créé.';
    RETURN;
  END IF;

  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('brand-assets', 'brand-assets', TRUE, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
  ON CONFLICT (id) DO NOTHING;

  EXECUTE 'DROP POLICY IF EXISTS "brand_assets_public_select" ON storage.objects';
  EXECUTE 'CREATE POLICY "brand_assets_public_select" ON storage.objects FOR SELECT
           USING (bucket_id = ''brand-assets'')';
  EXECUTE 'DROP POLICY IF EXISTS "brand_assets_insert" ON storage.objects';
  EXECUTE 'CREATE POLICY "brand_assets_insert" ON storage.objects FOR INSERT
           WITH CHECK (bucket_id = ''brand-assets'' AND public.can_manage_brand_object(name))';
  EXECUTE 'DROP POLICY IF EXISTS "brand_assets_update" ON storage.objects';
  EXECUTE 'CREATE POLICY "brand_assets_update" ON storage.objects FOR UPDATE
           USING (bucket_id = ''brand-assets'' AND public.can_manage_brand_object(name))
           WITH CHECK (bucket_id = ''brand-assets'' AND public.can_manage_brand_object(name))';
  EXECUTE 'DROP POLICY IF EXISTS "brand_assets_delete" ON storage.objects';
  EXECUTE 'CREATE POLICY "brand_assets_delete" ON storage.objects FOR DELETE
           USING (bucket_id = ''brand-assets'' AND public.can_manage_brand_object(name))';
END $$;

-- =====================================================
-- 18. Configuration seeds (inactive until an admin sets prices)
-- =====================================================
INSERT INTO public.subscription_plans
  (code, name, tier, audience, description, max_active_listings, featured_credits_per_period, max_members,
   features, capabilities, is_active, is_highlighted, sort_order)
VALUES
  ('starter', 'Starter', 'starter', 'all',
   'Pour démarrer une activité professionnelle sur Ciento-Immobilier.',
   10, 0, 1,
   '["Profil professionnel", "Gestion des annonces", "Statistiques de base", "Support standard"]',
   '{"basic_stats": true}', FALSE, FALSE, 1),
  ('business', 'Business', 'business', 'all',
   'Pour les agences en croissance qui veulent plus de visibilité.',
   40, 4, 5,
   '["Profil professionnel personnalisé", "Statistiques avancées", "Gestion du portefeuille", "Crédits de mise en avant inclus", "Gestion des prospects", "Support prioritaire"]',
   '{"basic_stats": true, "advanced_stats": true, "portfolio": true, "lead_management": true, "priority_support": true}',
   FALSE, TRUE, 2),
  ('enterprise', 'Enterprise', 'enterprise', 'agency',
   'Pour les réseaux d''agences : portefeuille étendu et équipe multi-utilisateurs.',
   NULL, 12, NULL,
   '["Portefeuille illimité", "Gestion multi-utilisateurs", "Gestion des agents", "Tableau de bord avancé", "Statistiques détaillées", "Page d''agence personnalisée"]',
   '{"basic_stats": true, "advanced_stats": true, "portfolio": true, "lead_management": true, "priority_support": true, "multi_user": true, "custom_page": true, "detailed_stats": true}',
   FALSE, FALSE, 3)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.promotion_offers (kind, name, duration_days, sort_order) VALUES
  ('sponsored', 'Sponsorisé 7 jours', 7, 1),
  ('sponsored', 'Sponsorisé 15 jours', 15, 2),
  ('sponsored', 'Sponsorisé 30 jours', 30, 3),
  ('premium', 'Premium 7 jours', 7, 1),
  ('premium', 'Premium 15 jours', 15, 2),
  ('premium', 'Premium 30 jours', 30, 3)
ON CONFLICT (kind, duration_days) DO NOTHING;

INSERT INTO public.service_categories (slug, name, short_description, description, icon, deliverables, sort_order) VALUES
  ('estimation-immobiliere', 'Estimation immobilière',
   'Connaître la valeur de marché de votre bien.',
   'Nos experts analysent votre bien, son emplacement et les transactions comparables pour vous proposer une fourchette de prix réaliste adaptée au marché haïtien.',
   'calculator', '["Visite du bien", "Analyse comparative du quartier", "Fourchette de prix argumentée"]', 1),
  ('evaluation-de-biens', 'Évaluation de biens',
   'Un rapport d''évaluation détaillé pour vos démarches.',
   'Rapport écrit d''évaluation pour une succession, une demande de crédit, un partage ou une assurance.',
   'clipboard-check', '["Inspection détaillée", "Rapport écrit", "Photos et relevés"]', 2),
  ('accompagnement-achat', 'Accompagnement à l''achat',
   'Trouver, vérifier et acheter en toute sérénité.',
   'Nous vous aidons à définir votre projet, sélectionner les biens, organiser les visites, vérifier les documents et négocier.',
   'key-round', '["Recherche ciblée", "Vérification des titres", "Négociation", "Suivi jusqu''à la signature"]', 3),
  ('accompagnement-vente', 'Accompagnement à la vente',
   'Vendre au bon prix, plus rapidement.',
   'Estimation, mise en valeur de l''annonce, diffusion, filtrage des acheteurs et accompagnement jusqu''à l''acte.',
   'tag', '["Estimation", "Photos et annonce optimisée", "Qualification des acheteurs", "Suivi juridique"]', 4),
  ('gestion-locative', 'Gestion locative',
   'Confiez-nous la gestion de vos locations.',
   'Recherche de locataires, état des lieux, encaissement des loyers et suivi de l''entretien de votre bien.',
   'building-2', '["Sélection des locataires", "États des lieux", "Suivi des loyers", "Entretien"]', 5),
  ('intermediation-immobiliere', 'Intermédiation immobilière',
   'Un intermédiaire de confiance entre les parties.',
   'Mise en relation qualifiée entre vendeurs, acheteurs, bailleurs et locataires, avec sécurisation des échanges.',
   'handshake', '["Mise en relation qualifiée", "Sécurisation des échanges", "Coordination des parties"]', 6),
  ('conseil-immobilier', 'Conseil immobilier',
   'Un avis d''expert pour vos décisions.',
   'Investissement, construction, fiscalité, choix de quartier : bénéficiez d''un conseil personnalisé.',
   'lightbulb', '["Entretien personnalisé", "Analyse du projet", "Recommandations écrites"]', 7)
ON CONFLICT (slug) DO NOTHING;

COMMIT;
