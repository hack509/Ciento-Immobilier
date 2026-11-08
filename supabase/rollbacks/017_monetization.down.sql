-- Rollback of 017_monetization.sql.
-- WARNING: deletes subscriptions, payments and invoices. Export financial data
-- (legal retention) before running this on any environment holding real data.
BEGIN;

DO $$
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'ciento-marketplace-maintenance';
  END IF;
  IF to_regclass('storage.objects') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "brand_assets_public_select" ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS "brand_assets_insert" ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS "brand_assets_update" ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS "brand_assets_delete" ON storage.objects';
  END IF;
END $$;

DROP TRIGGER IF EXISTS enforce_listing_quota ON public.properties;

DROP FUNCTION IF EXISTS public.can_manage_brand_object(TEXT);
DROP FUNCTION IF EXISTS public.run_marketplace_maintenance();
DROP FUNCTION IF EXISTS public.track_ad_event(UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.submit_service_request(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS public.redeem_sponsored_credit(UUID);
DROP FUNCTION IF EXISTS public.set_subscription_cancellation(UUID, BOOLEAN);
DROP FUNCTION IF EXISTS public.start_subscription_trial(UUID, public.billing_cycle, UUID);
DROP FUNCTION IF EXISTS public.checkout_promotion(public.promotion_kind, UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS public.checkout_subscription_renewal(UUID, TEXT);
DROP FUNCTION IF EXISTS public.checkout_subscription(UUID, public.billing_cycle, TEXT, UUID);
DROP FUNCTION IF EXISTS public.assert_subscriber_access(UUID);
DROP FUNCTION IF EXISTS public.cancel_my_payment(UUID);
DROP FUNCTION IF EXISTS public.fail_payment(UUID, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.confirm_payment(UUID, TEXT, NUMERIC, JSONB);
DROP FUNCTION IF EXISTS public.confirm_payment_internal(UUID, TEXT, NUMERIC, JSONB, UUID);
DROP FUNCTION IF EXISTS public.issue_invoice(UUID);
DROP FUNCTION IF EXISTS public.fulfill_payment(UUID);
DROP FUNCTION IF EXISTS public.create_pending_payment(public.payment_purpose, UUID, NUMERIC, TEXT, TEXT, UUID, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.assert_payment_provider(TEXT);
DROP FUNCTION IF EXISTS public.activate_promotion(UUID);
DROP FUNCTION IF EXISTS public.refresh_property_promotions(UUID);
DROP FUNCTION IF EXISTS public.get_my_quota(UUID);
DROP FUNCTION IF EXISTS public.enforce_listing_quota();
DROP FUNCTION IF EXISTS public.listing_usage(UUID, UUID);
DROP FUNCTION IF EXISTS public.listing_quota(UUID, UUID);
DROP FUNCTION IF EXISTS public.live_subscription_id(UUID, UUID);
DROP FUNCTION IF EXISTS public.billing_interval(public.billing_cycle);
DROP FUNCTION IF EXISTS public.protect_ad_counters() CASCADE;

-- Restore the 016 placeholder used by add_agency_member().
CREATE OR REPLACE FUNCTION public.agency_member_limit(p_agency_id UUID)
RETURNS INTEGER LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$ SELECT 1; $$;
REVOKE ALL ON FUNCTION public.agency_member_limit(UUID) FROM PUBLIC, anon, authenticated;

DROP VIEW IF EXISTS public.active_ad_campaigns;
DROP VIEW IF EXISTS public.sponsored_listings;
DROP VIEW IF EXISTS public.premium_listings;

DROP TABLE IF EXISTS public.advertising_clicks;
DROP TABLE IF EXISTS public.advertising_impressions;
DROP TABLE IF EXISTS public.advertising_campaigns;
DROP TABLE IF EXISTS public.service_requests;
DROP TABLE IF EXISTS public.service_categories;
DROP TABLE IF EXISTS public.listing_promotions;
DROP TABLE IF EXISTS public.promotion_offers;
DROP TABLE IF EXISTS public.invoices;
DROP TABLE IF EXISTS public.payments;
DROP TABLE IF EXISTS public.subscriptions;
DROP TABLE IF EXISTS public.subscription_plans;
DROP SEQUENCE IF EXISTS public.invoice_number_seq;

DROP TYPE IF EXISTS public.ad_placement;
DROP TYPE IF EXISTS public.service_request_status;
DROP TYPE IF EXISTS public.promotion_status;
DROP TYPE IF EXISTS public.promotion_kind;
DROP TYPE IF EXISTS public.payment_purpose;
DROP TYPE IF EXISTS public.payment_status;
DROP TYPE IF EXISTS public.subscription_status;
DROP TYPE IF EXISTS public.billing_cycle;

DELETE FROM public.site_settings WHERE key IN ('free_agency_member_limit', 'credit_boost_days');

COMMIT;
