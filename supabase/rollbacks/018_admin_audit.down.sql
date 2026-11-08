-- Rollback of 018_admin_audit.sql (audit history is lost: export it first).
BEGIN;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['subscription_plans', 'promotion_offers', 'service_categories',
                           'advertising_campaigns', 'site_settings', 'payments', 'subscriptions',
                           'service_requests', 'agency_members']
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS audit_%1$s ON public.%1$I', t);
    END IF;
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS audit_profiles_privileges ON public.profiles;
DROP TRIGGER IF EXISTS audit_agencies_status ON public.agencies;
DROP TRIGGER IF EXISTS audit_properties_moderation ON public.properties;
DROP TRIGGER IF EXISTS audit_properties_delete ON public.properties;

DROP FUNCTION IF EXISTS public.get_listing_stats(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.admin_marketplace_stats();
DROP FUNCTION IF EXISTS public.admin_financial_report(DATE, DATE);
DROP FUNCTION IF EXISTS public.admin_cancel_promotion(UUID, TEXT);
DROP FUNCTION IF EXISTS public.admin_refund_payment(UUID, TEXT);
DROP FUNCTION IF EXISTS public.admin_confirm_payment(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.admin_set_agency_status(UUID, BOOLEAN, BOOLEAN, TEXT);
DROP FUNCTION IF EXISTS public.request_agency_verification(UUID);
DROP FUNCTION IF EXISTS public.audit_row_change();
DROP FUNCTION IF EXISTS public.write_audit_log(TEXT, TEXT, TEXT, JSONB, JSONB, TEXT);
DROP TABLE IF EXISTS public.audit_logs;

COMMIT;
