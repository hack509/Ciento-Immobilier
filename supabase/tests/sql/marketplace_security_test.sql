-- =====================================================
-- Marketplace / monetization / security tests (plain psql, ON_ERROR_STOP)
-- Run with: npm run test:db   (see supabase/tests/README.md)
-- Each block raises an exception when an expectation is not met.
-- =====================================================
\set ON_ERROR_STOP 1
\set QUIET 1

-- ---------- Fixtures (as postgres) ----------
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'owner1@test.ht', '{"first_name":"Owner","last_name":"One","role":"owner"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'owner2@test.ht', '{"first_name":"Owner","last_name":"Two","role":"owner"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'agency@test.ht', '{"first_name":"Agence","last_name":"Boss","role":"agency"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'agent1@test.ht', '{"first_name":"Agent","last_name":"One"}'),
  ('00000000-0000-0000-0000-0000000000b3', 'agent2@test.ht', '{"first_name":"Agent","last_name":"Two"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'admin@test.ht', '{"first_name":"Admin","last_name":"Root","role":"super_admin"}');

DO $$
BEGIN
  -- handle_new_user must never grant privileged roles from metadata.
  IF (SELECT role FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000000c1') <> 'client' THEN
    RAISE EXCEPTION 'FAIL signup metadata granted a privileged role';
  END IF;
  IF (SELECT role FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000000b1') <> 'client' THEN
    RAISE EXCEPTION 'FAIL signup metadata granted agency role';
  END IF;
  RAISE NOTICE 'PASS signup cannot self-assign privileged roles';
END $$;

UPDATE public.profiles SET role = 'admin' WHERE id = '00000000-0000-0000-0000-0000000000c1';
UPDATE public.site_settings SET value = '2' WHERE key = 'free_owner_listing_limit';
UPDATE public.site_settings SET value = 'true' WHERE key = 'payments_simulation_enabled';

CREATE TEMP TABLE ctx (k TEXT PRIMARY KEY, v UUID);
GRANT ALL ON ctx TO PUBLIC;
INSERT INTO ctx VALUES
  ('city', (SELECT id FROM public.cities ORDER BY name LIMIT 1)),
  ('category', (SELECT id FROM public.categories ORDER BY sort_order LIMIT 1));

CREATE OR REPLACE FUNCTION pg_temp.new_listing(p_title TEXT, p_agency UUID DEFAULT NULL)
RETURNS UUID LANGUAGE sql AS $$
  INSERT INTO public.properties (owner_id, agency_id, category_id, city_id, title, slug, description,
                                 property_type, listing_type, price, status, sponsored_until, views_count)
  VALUES (auth.uid(), p_agency, (SELECT v FROM ctx WHERE k = 'category'), (SELECT v FROM ctx WHERE k = 'city'),
          p_title, lower(replace(p_title, ' ', '-')) || '-' || substr(gen_random_uuid()::TEXT, 1, 6),
          'Description suffisamment longue pour le test.', 'house', 'sale', 1000000,
          'active', NOW() + INTERVAL '1 year', 999)
  RETURNING id;
$$;

-- ---------- Owner 1 ----------
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', FALSE);

DO $$
BEGIN
  BEGIN
    UPDATE public.profiles SET role = 'admin' WHERE id = auth.uid();
    RAISE EXCEPTION 'FAIL owner changed own role';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS owner cannot change own role';
  END;
END $$;

DO $$
DECLARE
  v_id UUID := pg_temp.new_listing('Maison test un');
  v_row public.properties;
BEGIN
  SELECT * INTO v_row FROM public.properties WHERE id = v_id;
  IF v_row.status <> 'pending' OR v_row.is_published THEN
    RAISE EXCEPTION 'FAIL listing not forced to pending';
  END IF;
  IF v_row.sponsored_until IS NOT NULL OR v_row.views_count <> 0 THEN
    RAISE EXCEPTION 'FAIL client-supplied sponsored_until/views_count accepted';
  END IF;
  INSERT INTO ctx VALUES ('p1', v_id);
  RAISE NOTICE 'PASS new listing forced to pending, paid fields stripped';

  BEGIN
    UPDATE public.properties SET sponsored_until = NOW() + INTERVAL '30 days' WHERE id = v_id;
    RAISE EXCEPTION 'FAIL owner self-sponsored a listing';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS owner cannot set sponsored_until';
  END;

  BEGIN
    UPDATE public.properties SET status = 'active', is_published = TRUE WHERE id = v_id;
    RAISE EXCEPTION 'FAIL owner self-validated a listing';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS owner cannot validate own listing';
  END;

  UPDATE public.properties SET title = 'Maison test un modifiée' WHERE id = v_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'FAIL owner cannot edit own listing'; END IF;
  RAISE NOTICE 'PASS owner can edit own listing content';
END $$;

DO $$
BEGIN
  INSERT INTO ctx VALUES ('p1b', pg_temp.new_listing('Maison test deux'));
  BEGIN
    PERFORM pg_temp.new_listing('Maison test trois');
    RAISE EXCEPTION 'FAIL quota not enforced';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS free quota enforced (%).', SQLERRM;
  END;
END $$;

-- ---------- Owner 2: isolation ----------
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', FALSE);
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.properties SET title = 'Piraté' WHERE id = (SELECT v FROM ctx WHERE k = 'p1');
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL owner2 edited owner1 listing'; END IF;

  DELETE FROM public.properties WHERE id = (SELECT v FROM ctx WHERE k = 'p1');
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL owner2 deleted owner1 listing'; END IF;

  IF EXISTS (SELECT 1 FROM public.properties WHERE id = (SELECT v FROM ctx WHERE k = 'p1')) THEN
    RAISE EXCEPTION 'FAIL owner2 can read owner1 pending listing';
  END IF;
  RAISE NOTICE 'PASS owners are isolated from each other';
END $$;

-- ---------- Agency ----------
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', FALSE);
DO $$
DECLARE
  v_agency UUID;
BEGIN
  INSERT INTO public.agencies (owner_id, name, slug, phone, is_verified)
  VALUES (auth.uid(), 'Agence Test', 'agence-test', '+50900000000', TRUE)
  RETURNING id INTO v_agency;
  IF (SELECT is_verified FROM public.agencies WHERE id = v_agency) THEN
    RAISE EXCEPTION 'FAIL agency self-verified';
  END IF;
  INSERT INTO ctx VALUES ('agency', v_agency);
  RAISE NOTICE 'PASS new agency starts unverified';

  BEGIN
    INSERT INTO public.agencies (owner_id, name, slug, phone) VALUES (auth.uid(), 'Deuxième', 'deuxieme', '+509');
    RAISE EXCEPTION 'FAIL second agency allowed';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'PASS one agency per owner';
  END;

  PERFORM public.add_agency_member(v_agency, 'agent1@test.ht', 'agent', 'Négociateur');
  BEGIN
    PERFORM public.add_agency_member(v_agency, 'agent2@test.ht', 'agent', NULL);
    RAISE EXCEPTION 'FAIL member seat limit not enforced';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS member seat limit enforced without subscription';
  END;
END $$;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', FALSE);
DO $$
BEGIN
  BEGIN
    PERFORM pg_temp.new_listing('Intrusion agence', (SELECT v FROM ctx WHERE k = 'agency'));
    RAISE EXCEPTION 'FAIL outsider attached a listing to an agency';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS outsider cannot publish for an agency';
  END;
  BEGIN
    PERFORM public.add_agency_member((SELECT v FROM ctx WHERE k = 'agency'), 'owner2@test.ht', 'manager', NULL);
    RAISE EXCEPTION 'FAIL outsider added agency member';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS outsider cannot manage agency team';
  END;
END $$;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', FALSE);
DO $$
BEGIN
  INSERT INTO ctx VALUES ('agency_listing', pg_temp.new_listing('Villa agence', (SELECT v FROM ctx WHERE k = 'agency')));
  RAISE NOTICE 'PASS agent with publish permission can publish for the agency';
  UPDATE public.agency_members SET member_role = 'manager' WHERE profile_id = auth.uid();
  IF EXISTS (SELECT 1 FROM public.agency_members WHERE profile_id = auth.uid() AND member_role = 'manager') THEN
    RAISE EXCEPTION 'FAIL agent promoted itself';
  END IF;
  RAISE NOTICE 'PASS agent cannot promote itself';
END $$;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', FALSE);
UPDATE public.agency_members SET can_publish = FALSE WHERE profile_id = '00000000-0000-0000-0000-0000000000b2';
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', FALSE);
DO $$
BEGIN
  BEGIN
    PERFORM pg_temp.new_listing('Villa interdite', (SELECT v FROM ctx WHERE k = 'agency'));
    RAISE EXCEPTION 'FAIL agent without permission published';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS agent permissions are enforced';
  END;
END $$;

-- ---------- Admin moderation ----------
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', FALSE);
UPDATE public.properties SET status = 'active', is_published = TRUE, published_at = NOW()
WHERE id IN ((SELECT v FROM ctx WHERE k = 'p1'), (SELECT v FROM ctx WHERE k = 'agency_listing'));
UPDATE public.subscription_plans SET is_active = TRUE, price_monthly = 2500, price_yearly = 25000 WHERE code IN ('starter', 'business');
UPDATE public.promotion_offers SET is_active = TRUE, price = 500 WHERE duration_days = 7;
SELECT public.admin_set_agency_status((SELECT v FROM ctx WHERE k = 'agency'), TRUE, TRUE, NULL);
DO $$
BEGIN
  IF (SELECT role FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000000b1') <> 'agency' THEN
    RAISE EXCEPTION 'FAIL validated agency owner did not get the agency role';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.audit_logs WHERE entity_type = 'agencies') THEN
    RAISE EXCEPTION 'FAIL agency validation not audited';
  END IF;
  RAISE NOTICE 'PASS agency validation + audit trail';
END $$;

-- ---------- Visitor (anon) ----------
RESET ROLE;
SET ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', FALSE);
DO $$
BEGIN
  PERFORM public.submit_property_inquiry((SELECT v FROM ctx WHERE k = 'p1'), 'Jean Visiteur', 'jean@visiteur.ht',
                                         '+50911112222', 'Bonjour, ce bien est-il disponible ?');
  BEGIN
    PERFORM public.submit_property_inquiry((SELECT v FROM ctx WHERE k = 'p1'), 'Jean Visiteur', 'jean@visiteur.ht',
                                           NULL, 'Deuxième message identique immédiat.');
    RAISE EXCEPTION 'FAIL duplicate inquiry accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS duplicate inquiries are throttled';
  END;
  IF EXISTS (SELECT 1 FROM public.property_inquiries) THEN
    RAISE EXCEPTION 'FAIL anon can read inquiries';
  END IF;
  IF EXISTS (SELECT 1 FROM public.payments) OR EXISTS (SELECT 1 FROM public.advertising_campaigns) THEN
    RAISE EXCEPTION 'FAIL anon can read private tables';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.subscription_plans WHERE code = 'starter') THEN
    RAISE EXCEPTION 'FAIL anon cannot read active plans';
  END IF;
  RAISE NOTICE 'PASS visitor can contact, private data hidden, plans public';
  PERFORM public.submit_service_request((SELECT id FROM public.service_categories WHERE slug = 'estimation-immobiliere'),
    'Marie Client', 'marie@client.ht', '+50933334444', 'Gonaïves', 'Je souhaite estimer ma maison.', 'phone', NULL);
  RAISE NOTICE 'PASS visitor can request a real-estate service';
END $$;

DO $$
BEGIN
  BEGIN
    PERFORM public.checkout_subscription((SELECT id FROM public.subscription_plans WHERE code = 'starter'), 'monthly', 'simulated', NULL);
    RAISE EXCEPTION 'FAIL anon reached checkout';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS anon cannot checkout';
  END;
END $$;

-- ---------- Owner 1: leads + payments ----------
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', FALSE);
DO $$
DECLARE
  v_pay public.payments;
  v_pay2 public.payments;
  v_count INTEGER;
BEGIN
  IF (SELECT count(*) FROM public.property_inquiries) <> 1 THEN
    RAISE EXCEPTION 'FAIL owner cannot see inquiry for own listing';
  END IF;
  RAISE NOTICE 'PASS owner receives leads';

  v_pay := public.checkout_subscription((SELECT id FROM public.subscription_plans WHERE code = 'starter'), 'monthly', 'simulated', NULL);
  IF v_pay.status <> 'pending' OR v_pay.amount <> 2500 THEN
    RAISE EXCEPTION 'FAIL checkout amount/status wrong: % %', v_pay.status, v_pay.amount;
  END IF;
  v_pay2 := public.checkout_subscription((SELECT id FROM public.subscription_plans WHERE code = 'starter'), 'monthly', 'simulated', NULL);
  IF v_pay2.id <> v_pay.id THEN
    RAISE EXCEPTION 'FAIL duplicate checkout created a second payment';
  END IF;
  INSERT INTO ctx VALUES ('pay_sub', v_pay.id);
  RAISE NOTICE 'PASS server-side amount, duplicate checkout reused';

  UPDATE public.payments SET status = 'succeeded' WHERE id = v_pay.id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL client marked its own payment as paid'; END IF;

  BEGIN
    INSERT INTO public.payments (user_id, purpose, amount, provider, status)
    VALUES (auth.uid(), 'subscription', 1, 'simulated', 'succeeded');
    RAISE EXCEPTION 'FAIL client inserted a payment';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS client cannot insert payments';
  END;

  BEGIN
    PERFORM public.confirm_payment(v_pay.id, 'fake-ref', 2500, '{}');
    RAISE EXCEPTION 'FAIL client called confirm_payment';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS client cannot confirm payments';
  END;

  BEGIN
    PERFORM public.admin_confirm_payment(v_pay.id, 'fake-ref', NULL);
    RAISE EXCEPTION 'FAIL client called admin_confirm_payment';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS client cannot use admin confirmation';
  END;

  BEGIN
    UPDATE public.subscriptions SET status = 'active', current_period_end = NOW() + INTERVAL '10 years';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL client activated its subscription'; END IF;
    RAISE NOTICE 'PASS client cannot activate a subscription';
  END;
END $$;

-- Provider callback (service_role)
RESET ROLE;
SET ROLE service_role;
SELECT set_config('request.jwt.claim.sub', '', FALSE);
DO $$
DECLARE
  v_pay public.payments;
BEGIN
  v_pay := public.confirm_payment((SELECT v FROM ctx WHERE k = 'pay_sub'), 'MC-UNDERPAID', 100, '{}');
  IF v_pay.status <> 'failed' THEN RAISE EXCEPTION 'FAIL underpayment accepted'; END IF;
  RAISE NOTICE 'PASS underpayment rejected';

  v_pay := public.confirm_payment((SELECT v FROM ctx WHERE k = 'pay_sub'), 'MC-0001', 2500, '{"verified":true}');
  IF v_pay.status <> 'succeeded' THEN RAISE EXCEPTION 'FAIL payment not confirmed'; END IF;
  v_pay := public.confirm_payment((SELECT v FROM ctx WHERE k = 'pay_sub'), 'MC-0001', 2500, '{"verified":true}');
  IF v_pay.status <> 'succeeded' THEN RAISE EXCEPTION 'FAIL confirmation not idempotent'; END IF;
  IF (SELECT count(*) FROM public.invoices WHERE payment_id = v_pay.id) <> 1 THEN
    RAISE EXCEPTION 'FAIL invoice missing or duplicated';
  END IF;
  IF (SELECT status FROM public.subscriptions WHERE id = v_pay.reference_id) <> 'active' THEN
    RAISE EXCEPTION 'FAIL subscription not activated';
  END IF;
  RAISE NOTICE 'PASS confirmation activates subscription once, issues one invoice';
END $$;

RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', FALSE);
DO $$
DECLARE
  v_quota JSONB := public.get_my_quota(NULL);
  v_pay public.payments;
BEGIN
  IF (v_quota ->> 'limit')::INT <> 10 OR v_quota ->> 'plan_code' <> 'starter' THEN
    RAISE EXCEPTION 'FAIL quota not raised by plan: %', v_quota;
  END IF;
  PERFORM pg_temp.new_listing('Maison test trois');
  RAISE NOTICE 'PASS subscription raises the listing limit';

  v_pay := public.checkout_promotion('sponsored', (SELECT v FROM ctx WHERE k = 'p1'),
                                     (SELECT id FROM public.promotion_offers WHERE kind = 'sponsored' AND duration_days = 7),
                                     'simulated');
  INSERT INTO ctx VALUES ('pay_promo', v_pay.id);

  BEGIN
    PERFORM public.checkout_promotion('premium', (SELECT v FROM ctx WHERE k = 'p1b'),
                                      (SELECT id FROM public.promotion_offers WHERE kind = 'premium' AND duration_days = 7),
                                      'simulated');
    RAISE EXCEPTION 'FAIL promotion bought for a non-validated listing';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS only live listings can be promoted';
  END;
END $$;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', FALSE);
DO $$
BEGIN
  BEGIN
    PERFORM public.checkout_promotion('sponsored', (SELECT v FROM ctx WHERE k = 'p1'),
                                      (SELECT id FROM public.promotion_offers WHERE kind = 'sponsored' AND duration_days = 7),
                                      'simulated');
    RAISE EXCEPTION 'FAIL owner2 promoted owner1 listing';
  EXCEPTION WHEN no_data_found THEN
    RAISE NOTICE 'PASS cannot promote somebody else''s listing';
  END;
  IF EXISTS (SELECT 1 FROM public.payments) OR EXISTS (SELECT 1 FROM public.invoices) THEN
    RAISE EXCEPTION 'FAIL owner2 can read owner1 payments/invoices';
  END IF;
  RAISE NOTICE 'PASS financial data isolated between users';
END $$;

RESET ROLE;
SET ROLE service_role;
SELECT set_config('request.jwt.claim.sub', '', FALSE);
SELECT public.confirm_payment((SELECT v FROM ctx WHERE k = 'pay_promo'), 'MC-0002', 500, '{}');
RESET ROLE;
DO $$
BEGIN
  IF (SELECT sponsored_until FROM public.properties WHERE id = (SELECT v FROM ctx WHERE k = 'p1')) <= NOW() THEN
    RAISE EXCEPTION 'FAIL sponsored promotion not active after payment';
  END IF;
  RAISE NOTICE 'PASS sponsored listing activated after confirmed payment';

  -- Time travel: promotion and subscription are over.
  UPDATE public.listing_promotions SET starts_at = NOW() - INTERVAL '8 days', ends_at = NOW() - INTERVAL '1 day';
  UPDATE public.subscriptions SET current_period_start = NOW() - INTERVAL '40 days', current_period_end = NOW() - INTERVAL '1 minute'
  WHERE status = 'active';
  PERFORM public.run_marketplace_maintenance();

  IF (SELECT sponsored_until FROM public.properties WHERE id = (SELECT v FROM ctx WHERE k = 'p1')) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL sponsored_until not cleared on expiry';
  END IF;
  IF EXISTS (SELECT 1 FROM public.listing_promotions WHERE status = 'active') THEN
    RAISE EXCEPTION 'FAIL promotion not expired';
  END IF;
  IF EXISTS (SELECT 1 FROM public.subscriptions WHERE status = 'active') THEN
    RAISE EXCEPTION 'FAIL subscription not expired';
  END IF;
  RAISE NOTICE 'PASS automatic expiry of promotions and subscriptions';
END $$;

-- Renewal of the expired subscription, then refund by an admin
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', FALSE);
DO $$
DECLARE
  v_pay public.payments;
BEGIN
  v_pay := public.checkout_subscription_renewal(
    (SELECT id FROM public.subscriptions WHERE status = 'expired' LIMIT 1), 'manual');
  INSERT INTO ctx VALUES ('pay_renew', v_pay.id);
  RAISE NOTICE 'PASS renewal checkout created';
END $$;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', FALSE);
DO $$
DECLARE
  v_pay public.payments;
BEGIN
  v_pay := public.admin_confirm_payment((SELECT v FROM ctx WHERE k = 'pay_renew'), 'VIREMENT-123', 'Reçu banque');
  IF (SELECT status FROM public.subscriptions WHERE id = v_pay.reference_id) <> 'active' THEN
    RAISE EXCEPTION 'FAIL renewal did not reactivate the subscription';
  END IF;
  RAISE NOTICE 'PASS manual confirmation renews subscription';

  PERFORM public.admin_refund_payment(v_pay.id, 'Erreur de facturation');
  IF (SELECT status FROM public.subscriptions WHERE id = v_pay.reference_id) <> 'cancelled' THEN
    RAISE EXCEPTION 'FAIL refund did not withdraw the subscription';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.audit_logs WHERE action = 'refund') THEN
    RAISE EXCEPTION 'FAIL refund not audited';
  END IF;
  RAISE NOTICE 'PASS refund withdraws benefit and is audited';

  IF (public.admin_financial_report(CURRENT_DATE - 1, CURRENT_DATE) -> 'totals') = '[]'::JSONB THEN
    RAISE EXCEPTION 'FAIL financial report empty';
  END IF;
  RAISE NOTICE 'PASS financial report';

  INSERT INTO public.advertising_campaigns (advertiser_name, advertiser_sector, title, image_url, target_url,
                                            placement, starts_at, ends_at, is_active, impressions_count)
  VALUES ('BTP Artibonite', 'construction', 'Construisez avec nous', 'https://cdn.test/banner.webp',
          'https://btp.test', 'home_banner', NOW() - INTERVAL '1 hour', NOW() + INTERVAL '7 days', TRUE, 9999);
  IF (SELECT impressions_count FROM public.advertising_campaigns LIMIT 1) <> 0 THEN
    RAISE EXCEPTION 'FAIL ad counters writable on insert';
  END IF;
  RAISE NOTICE 'PASS ad campaign created with protected counters';
END $$;

RESET ROLE;
SET ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', FALSE);
SELECT public.track_ad_event((SELECT id FROM public.active_ad_campaigns LIMIT 1), 'impression', 'session-abc', '/');
SELECT public.track_ad_event((SELECT id FROM public.active_ad_campaigns LIMIT 1), 'impression', 'session-abc', '/');
SELECT public.track_ad_event((SELECT id FROM public.active_ad_campaigns LIMIT 1), 'click', 'session-abc', '/');
RESET ROLE;
DO $$
BEGIN
  IF (SELECT impressions_count FROM public.advertising_campaigns LIMIT 1) <> 1
     OR (SELECT clicks_count FROM public.advertising_campaigns LIMIT 1) <> 1 THEN
    RAISE EXCEPTION 'FAIL ad tracking counts wrong';
  END IF;
  RAISE NOTICE 'PASS ad impressions/clicks tracked and de-duplicated';
END $$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', FALSE);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.audit_logs) THEN
    RAISE EXCEPTION 'FAIL non-admin can read audit logs';
  END IF;
  IF EXISTS (SELECT 1 FROM public.service_requests) THEN
    RAISE EXCEPTION 'FAIL user can read other people''s service requests';
  END IF;
  BEGIN
    PERFORM public.admin_financial_report(CURRENT_DATE - 1, CURRENT_DATE);
    RAISE EXCEPTION 'FAIL non-admin read financial report';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS admin reports and audit logs are admin-only';
  END;
END $$;

RESET ROLE;
UPDATE public.site_settings SET value = 'false' WHERE key = 'payments_simulation_enabled';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', FALSE);
DO $$
BEGIN
  BEGIN
    PERFORM public.checkout_subscription((SELECT id FROM public.subscription_plans WHERE code = 'starter'), 'monthly', 'simulated', NULL);
    RAISE EXCEPTION 'FAIL simulated payments usable while disabled';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS simulated payments blocked when disabled';
  END;
END $$;

-- ---------- Trial, plan change with proration, storage & deletion ----------
RESET ROLE;
UPDATE public.site_settings SET value = 'true' WHERE key = 'payments_simulation_enabled';
UPDATE public.subscription_plans SET trial_days = 14 WHERE code = 'starter';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', FALSE);
DO $$
DECLARE
  v_sub public.subscriptions;
  v_pay public.payments;
BEGIN
  v_sub := public.start_subscription_trial((SELECT id FROM public.subscription_plans WHERE code = 'starter'), 'monthly', NULL);
  IF v_sub.status <> 'trialing' THEN RAISE EXCEPTION 'FAIL trial not started'; END IF;
  BEGIN
    PERFORM public.start_subscription_trial((SELECT id FROM public.subscription_plans WHERE code = 'starter'), 'monthly', NULL);
    RAISE EXCEPTION 'FAIL second trial allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'PASS free trial granted once';

  -- Upgrade during the trial: full price (no credit for an unpaid trial).
  v_pay := public.checkout_subscription((SELECT id FROM public.subscription_plans WHERE code = 'business'), 'monthly', 'simulated', NULL);
  IF v_pay.amount <> 2500 THEN RAISE EXCEPTION 'FAIL upgrade from trial amount %', v_pay.amount; END IF;
  INSERT INTO ctx VALUES ('pay_upgrade', v_pay.id);
END $$;

RESET ROLE;
SET ROLE service_role;
SELECT set_config('request.jwt.claim.sub', '', FALSE);
SELECT public.confirm_payment((SELECT v FROM ctx WHERE k = 'pay_upgrade'), 'MC-UPGRADE', 2500, '{}');
RESET ROLE;
-- Pretend half of the paid business period is used, then switch to the yearly cycle.
UPDATE public.subscriptions SET current_period_start = NOW() - INTERVAL '15 days', current_period_end = NOW() + INTERVAL '15 days'
WHERE user_id = '00000000-0000-0000-0000-0000000000a2' AND status = 'active';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', FALSE);
DO $$
DECLARE
  v_pay public.payments;
BEGIN
  IF (SELECT count(*) FROM public.subscriptions WHERE status IN ('active', 'trialing')) <> 1 THEN
    RAISE EXCEPTION 'FAIL more than one live subscription after upgrade';
  END IF;
  v_pay := public.checkout_subscription((SELECT id FROM public.subscription_plans WHERE code = 'business'), 'yearly', 'simulated', NULL);
  IF v_pay.amount NOT BETWEEN 23700 AND 23800 THEN
    RAISE EXCEPTION 'FAIL proration credit not applied: %', v_pay.amount;
  END IF;
  RAISE NOTICE 'PASS plan change: trial replaced, prorated credit applied (% HTG)', v_pay.amount;
END $$;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', FALSE);
DO $$
BEGIN
  -- agent1 lost publish rights earlier: cannot upload images for agency listings.
  IF public.can_manage_property_object('properties/' || (SELECT v FROM ctx WHERE k = 'agency_listing') || '/photo.jpg') THEN
    RAISE EXCEPTION 'FAIL agent without permission can upload images';
  END IF;
  RAISE NOTICE 'PASS image upload rights follow agency permissions';
END $$;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', FALSE);
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  IF NOT public.can_manage_property_object('properties/' || (SELECT v FROM ctx WHERE k = 'agency_listing') || '/photo.jpg') THEN
    RAISE EXCEPTION 'FAIL agency owner cannot upload images to the portfolio';
  END IF;
  DELETE FROM public.properties WHERE id = (SELECT v FROM ctx WHERE k = 'agency_listing');
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL agency owner cannot delete a portfolio listing'; END IF;
  RAISE NOTICE 'PASS agency owner manages the whole portfolio (images, deletion)';
END $$;

RESET ROLE;
\echo 'ALL DATABASE TESTS PASSED'
