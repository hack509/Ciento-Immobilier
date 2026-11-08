-- =====================================================
-- Ciento-Immobilier: Administration & audit (phase 6)
-- =====================================================
--   * audit_logs: append-only journal of administrative / financial changes
--   * Admin RPCs: agency validation, manual payment confirmation, refunds
--   * Financial report & marketplace KPIs
-- Rollback: supabase/rollbacks/018_admin_audit.down.sql

BEGIN;

-- =====================================================
-- 1. Audit log
-- =====================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  old_values JSONB,
  new_values JSONB,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs (actor_id, created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_select_admin" ON public.audit_logs;
CREATE POLICY "audit_logs_select_admin" ON public.audit_logs
  FOR SELECT USING (public.is_admin());
-- No INSERT / UPDATE / DELETE policies: written only by SECURITY DEFINER code.

CREATE OR REPLACE FUNCTION public.write_audit_log(
  p_action TEXT, p_entity_type TEXT, p_entity_id TEXT, p_old JSONB, p_new JSONB, p_note TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, old_values, new_values, note)
  VALUES (auth.uid(), COALESCE(public.get_user_role()::TEXT, current_user::TEXT), p_action, p_entity_type, p_entity_id,
          p_old, p_new, p_note);
$$;

REVOKE ALL ON FUNCTION public.write_audit_log(TEXT, TEXT, TEXT, JSONB, JSONB, TEXT) FROM PUBLIC, anon, authenticated;

-- Generic row trigger: stores only the columns that changed.
CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old JSONB := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END;
  v_new JSONB := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END;
  v_any JSONB := COALESCE(v_new, v_old);
  v_old_diff JSONB;
  v_new_diff JSONB;
BEGIN
  -- Financial tables are always audited; others only for admin actions.
  IF TG_TABLE_NAME NOT IN ('payments', 'subscriptions') AND NOT public.is_admin() THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    SELECT jsonb_object_agg(n.key, n.value), jsonb_object_agg(n.key, v_old -> n.key)
    INTO v_new_diff, v_old_diff
    FROM jsonb_each(v_new) AS n
    WHERE n.key NOT IN ('updated_at') AND (v_old -> n.key) IS DISTINCT FROM n.value;

    IF v_new_diff IS NULL THEN
      RETURN NULL; -- nothing meaningful changed
    END IF;
  ELSE
    v_old_diff := v_old;
    v_new_diff := v_new;
  END IF;

  PERFORM public.write_audit_log(
    lower(TG_OP), TG_TABLE_NAME, COALESCE(v_any ->> 'id', v_any ->> 'key'), v_old_diff, v_new_diff
  );
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_row_change() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['subscription_plans', 'promotion_offers', 'service_categories',
                           'advertising_campaigns', 'site_settings', 'payments', 'subscriptions',
                           'service_requests', 'agency_members']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%1$s ON public.%1$I', t);
    EXECUTE format('CREATE TRIGGER audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$I
                    FOR EACH ROW EXECUTE FUNCTION public.audit_row_change()', t);
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS audit_profiles_privileges ON public.profiles;
CREATE TRIGGER audit_profiles_privileges
  AFTER UPDATE OF role, is_active, is_verified ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

DROP TRIGGER IF EXISTS audit_agencies_status ON public.agencies;
CREATE TRIGGER audit_agencies_status
  AFTER UPDATE OF is_verified, is_active ON public.agencies
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

DROP TRIGGER IF EXISTS audit_properties_moderation ON public.properties;
CREATE TRIGGER audit_properties_moderation
  AFTER UPDATE OF status, is_published, is_featured ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

DROP TRIGGER IF EXISTS audit_properties_delete ON public.properties;
CREATE TRIGGER audit_properties_delete
  AFTER DELETE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- =====================================================
-- 2. Agencies: verification workflow
-- =====================================================
CREATE OR REPLACE FUNCTION public.request_agency_verification(p_agency_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_name TEXT;
BEGIN
  IF NOT public.is_agency_owner(p_agency_id) THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;

  UPDATE public.agencies SET verification_requested_at = NOW()
  WHERE id = p_agency_id AND NOT is_verified
  RETURNING name INTO v_name;

  IF v_name IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, link)
  SELECT pr.id, 'system', 'Agence à valider', format('L''agence « %s » demande sa validation.', v_name), '/admin/agences'
  FROM public.profiles AS pr WHERE pr.role IN ('admin', 'super_admin') AND pr.is_active;
END;
$$;

REVOKE ALL ON FUNCTION public.request_agency_verification(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_agency_verification(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_agency_status(
  p_agency_id UUID, p_verified BOOLEAN, p_active BOOLEAN, p_note TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_agency public.agencies%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;

  UPDATE public.agencies SET is_verified = p_verified, is_active = p_active
  WHERE id = p_agency_id
  RETURNING * INTO v_agency;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agence introuvable' USING ERRCODE = 'P0002';
  END IF;

  -- A validated agency owner gets the professional role (never downgrades admins).
  IF p_verified THEN
    UPDATE public.profiles SET role = 'agency'
    WHERE id = v_agency.owner_id AND role IN ('client', 'owner');
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, link)
  VALUES (v_agency.owner_id, 'system',
          CASE WHEN p_verified THEN 'Agence validée' WHEN NOT p_active THEN 'Agence suspendue' ELSE 'Agence non validée' END,
          CASE WHEN p_verified THEN format('Votre agence « %s » est validée.', v_agency.name)
               ELSE format('Le statut de votre agence « %s » a été mis à jour.%s', v_agency.name,
                           COALESCE(' Motif : ' || p_note, '')) END,
          '/dashboard/agence');

  IF p_note IS NOT NULL THEN
    PERFORM public.write_audit_log('note', 'agencies', p_agency_id::TEXT, NULL, NULL, p_note);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_agency_status(UUID, BOOLEAN, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_agency_status(UUID, BOOLEAN, BOOLEAN, TEXT) TO authenticated;

-- =====================================================
-- 3. Payments: manual confirmation & refunds (admins)
-- =====================================================
CREATE OR REPLACE FUNCTION public.admin_confirm_payment(p_payment_id UUID, p_reference TEXT, p_note TEXT DEFAULT NULL)
RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_payment public.payments;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;
  IF p_reference IS NULL OR char_length(trim(p_reference)) < 3 THEN
    RAISE EXCEPTION 'Référence de paiement obligatoire (reçu, virement, transaction)' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction introuvable' USING ERRCODE = 'P0002';
  END IF;

  v_payment := public.confirm_payment_internal(
    p_payment_id, trim(p_reference), v_payment.amount,
    jsonb_build_object('confirmed_manually', TRUE, 'note', p_note), auth.uid()
  );
  PERFORM public.write_audit_log('manual_confirmation', 'payments', p_payment_id::TEXT, NULL,
                                 jsonb_build_object('reference', p_reference), p_note);
  RETURN v_payment;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_refund_payment(p_payment_id UUID, p_reason TEXT)
RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_payment public.payments;
  v_property UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;
  IF p_reason IS NULL OR char_length(trim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'Motif de remboursement obligatoire' USING ERRCODE = '22023';
  END IF;

  UPDATE public.payments
  SET status = 'refunded', refunded_at = NOW(), failure_reason = left(trim(p_reason), 200)
  WHERE id = p_payment_id AND status = 'succeeded'
  RETURNING * INTO v_payment;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Seul un paiement confirmé peut être remboursé' USING ERRCODE = 'P0001';
  END IF;

  -- Withdraw the benefit that was granted by this payment.
  IF v_payment.purpose IN ('subscription', 'subscription_renewal') THEN
    UPDATE public.subscriptions SET status = 'cancelled', cancelled_at = NOW()
    WHERE id = v_payment.reference_id AND status IN ('trialing', 'active', 'past_due');
  ELSIF v_payment.purpose IN ('sponsored_listing', 'premium_listing') THEN
    UPDATE public.listing_promotions SET status = 'cancelled'
    WHERE id = v_payment.reference_id
    RETURNING property_id INTO v_property;
    IF v_property IS NOT NULL THEN
      PERFORM public.refresh_property_promotions(v_property);
    END IF;
  END IF;

  UPDATE public.invoices SET status = 'refunded' WHERE payment_id = p_payment_id;
  PERFORM public.write_audit_log('refund', 'payments', p_payment_id::TEXT, NULL, NULL, p_reason);

  IF v_payment.user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (v_payment.user_id, 'system', 'Paiement remboursé',
            format('Votre paiement de %s %s a été remboursé.', v_payment.amount, v_payment.currency),
            '/dashboard/paiements');
  END IF;
  RETURN v_payment;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_cancel_promotion(p_promotion_id UUID, p_reason TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_property UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;
  UPDATE public.listing_promotions SET status = 'cancelled'
  WHERE id = p_promotion_id AND status IN ('active', 'scheduled', 'pending_payment')
  RETURNING property_id INTO v_property;
  IF v_property IS NOT NULL THEN
    PERFORM public.refresh_property_promotions(v_property);
    PERFORM public.write_audit_log('cancel', 'listing_promotions', p_promotion_id::TEXT, NULL, NULL, p_reason);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_confirm_payment(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_refund_payment(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_cancel_promotion(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_confirm_payment(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_refund_payment(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cancel_promotion(UUID, TEXT) TO authenticated;

-- =====================================================
-- 4. Reports
-- =====================================================
CREATE OR REPLACE FUNCTION public.admin_financial_report(p_from DATE, p_to DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_from TIMESTAMPTZ := p_from::TIMESTAMPTZ;
  v_to TIMESTAMPTZ := (p_to + 1)::TIMESTAMPTZ;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'totals', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('currency', currency, 'revenue', revenue, 'refunded', refunded, 'payments', n))
      FROM (
        SELECT currency,
               sum(amount) FILTER (WHERE status = 'succeeded') AS revenue,
               sum(amount) FILTER (WHERE status = 'refunded') AS refunded,
               count(*) FILTER (WHERE status = 'succeeded') AS n
        FROM public.payments
        WHERE confirmed_at >= v_from AND confirmed_at < v_to AND amount > 0
        GROUP BY currency
      ) AS t), '[]'::JSONB),
    'by_purpose', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('purpose', purpose, 'currency', currency, 'revenue', revenue, 'payments', n) ORDER BY revenue DESC)
      FROM (
        SELECT purpose, currency, sum(amount) AS revenue, count(*) AS n
        FROM public.payments
        WHERE status = 'succeeded' AND confirmed_at >= v_from AND confirmed_at < v_to AND amount > 0
        GROUP BY purpose, currency
      ) AS t), '[]'::JSONB),
    'by_month', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('month', month, 'currency', currency, 'revenue', revenue) ORDER BY month)
      FROM (
        SELECT to_char(date_trunc('month', confirmed_at), 'YYYY-MM') AS month, currency, sum(amount) AS revenue
        FROM public.payments
        WHERE status = 'succeeded' AND confirmed_at >= v_from AND confirmed_at < v_to AND amount > 0
        GROUP BY 1, 2
      ) AS t), '[]'::JSONB),
    'by_provider', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('provider', provider, 'revenue', revenue, 'payments', n))
      FROM (
        SELECT provider, sum(amount) AS revenue, count(*) AS n
        FROM public.payments
        WHERE status = 'succeeded' AND confirmed_at >= v_from AND confirmed_at < v_to AND amount > 0
        GROUP BY provider
      ) AS t), '[]'::JSONB),
    'recurring', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('currency', currency, 'mrr', mrr, 'subscriptions', n))
      FROM (
        SELECT currency,
               round(sum(CASE billing_cycle WHEN 'yearly' THEN price_amount / 12 ELSE price_amount END), 2) AS mrr,
               count(*) AS n
        FROM public.subscriptions
        WHERE status = 'active' AND current_period_end > NOW()
        GROUP BY currency
      ) AS t), '[]'::JSONB),
    'failed_payments', (
      SELECT count(*) FROM public.payments
      WHERE status = 'failed' AND created_at >= v_from AND created_at < v_to)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_marketplace_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'agencies_total', (SELECT count(*) FROM public.agencies),
    'agencies_pending', (SELECT count(*) FROM public.agencies WHERE NOT is_verified AND is_active),
    'subscriptions_active', (SELECT count(*) FROM public.subscriptions
                             WHERE status IN ('active', 'trialing') AND current_period_end > NOW()),
    'payments_pending', (SELECT count(*) FROM public.payments WHERE status = 'pending' AND expires_at > NOW()),
    'promotions_active', (SELECT count(*) FROM public.listing_promotions WHERE status = 'active' AND ends_at > NOW()),
    'service_requests_new', (SELECT count(*) FROM public.service_requests WHERE status = 'new'),
    'ad_campaigns_live', (SELECT count(*) FROM public.active_ad_campaigns),
    'revenue_month', COALESCE((SELECT sum(amount) FROM public.payments
                               WHERE status = 'succeeded' AND currency = 'HTG'
                                 AND confirmed_at >= date_trunc('month', NOW())), 0),
    'inquiries_week', (SELECT count(*) FROM public.property_inquiries WHERE created_at > NOW() - INTERVAL '7 days')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_financial_report(DATE, DATE) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_marketplace_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_financial_report(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_marketplace_stats() TO authenticated;

-- Statistics for one owner / agency (dashboard charts).
CREATE OR REPLACE FUNCTION public.get_listing_stats(p_agency_id UUID DEFAULT NULL, p_days INTEGER DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_days INTEGER := LEAST(GREATEST(COALESCE(p_days, 30), 7), 365);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise' USING ERRCODE = '42501';
  END IF;
  IF p_agency_id IS NOT NULL AND NOT (public.is_agency_member(p_agency_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;

  -- History longer than 7 days is a paid capability ("statistiques avancées").
  IF NOT public.is_admin() AND NOT COALESCE((
    SELECT (pl.capabilities ->> 'advanced_stats')::BOOLEAN
    FROM public.subscriptions AS s JOIN public.subscription_plans AS pl ON pl.id = s.plan_id
    WHERE s.id = public.live_subscription_id(auth.uid(), p_agency_id)
  ), FALSE) THEN
    v_days := 7;
  END IF;

  RETURN (
    WITH scope AS (
      SELECT p.id, p.title, p.slug, p.status, p.views_count, p.favorites_count, p.inquiries_count,
             p.sponsored_until, p.premium_until
      FROM public.properties AS p
      WHERE (p_agency_id IS NOT NULL AND p.agency_id = p_agency_id)
         OR (p_agency_id IS NULL AND p.owner_id = auth.uid())
    ), days AS (
      SELECT d.day, COALESCE(sum(d.views), 0) AS views, COALESCE(sum(d.inquiries), 0) AS inquiries,
             COALESCE(sum(d.favorites), 0) AS favorites
      FROM public.property_daily_stats AS d
      WHERE d.property_id IN (SELECT id FROM scope) AND d.day > CURRENT_DATE - v_days
      GROUP BY d.day
    )
    SELECT jsonb_build_object(
      'totals', jsonb_build_object(
        'listings', (SELECT count(*) FROM scope),
        'active', (SELECT count(*) FROM scope WHERE status = 'active'),
        'views', (SELECT COALESCE(sum(views_count), 0) FROM scope),
        'favorites', (SELECT COALESCE(sum(favorites_count), 0) FROM scope),
        'inquiries', (SELECT COALESCE(sum(inquiries_count), 0) FROM scope)
      ),
      'daily', COALESCE((SELECT jsonb_agg(jsonb_build_object('day', day, 'views', views, 'inquiries', inquiries, 'favorites', favorites) ORDER BY day) FROM days), '[]'::JSONB),
      'listings', COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.views_count DESC) FROM (SELECT * FROM scope LIMIT 100) AS s), '[]'::JSONB)
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_listing_stats(UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_listing_stats(UUID, INTEGER) TO authenticated;

COMMIT;
