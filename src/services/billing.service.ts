import { supabase } from './supabase';
import type {
  BillingCycle, Invoice, ListingPromotion, Payment, PaymentProvider, PromotionKind, PromotionOffer, Subscription,
  SubscriptionPlan,
} from '@/types/marketplace';

export type CheckoutProvider = Exclude<PaymentProvider, 'credit'>;

export interface PaymentStartResult {
  status: Payment['status'];
  redirect_url?: string;
  instructions?: string;
  reference?: string;
  simulated?: boolean;
  error?: string;
}

class BillingService {
  // ---------------------------------------------------------------- Catalogue
  async getPlans(): Promise<SubscriptionPlan[]> {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .eq('is_public', true)
      .order('sort_order');
    if (error) throw error;
    return (data || []) as SubscriptionPlan[];
  }

  async getOffers(kind?: PromotionKind): Promise<PromotionOffer[]> {
    let query = supabase.from('promotion_offers').select('*').eq('is_active', true).order('kind').order('duration_days');
    if (kind) query = query.eq('kind', kind);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as PromotionOffer[];
  }

  // ---------------------------------------------------------------- Subscriber data
  async getSubscriptions(userId: string, agencyId: string | null): Promise<Subscription[]> {
    const query = supabase
      .from('subscriptions')
      .select('*, plan:subscription_plans(*)')
      .neq('status', 'pending_payment')
      .order('created_at', { ascending: false })
      .limit(50);
    const { data, error } = await (agencyId ? query.eq('agency_id', agencyId) : query.eq('user_id', userId));
    if (error) throw error;
    return (data || []) as Subscription[];
  }

  async getPayments(userId: string, agencyId: string | null): Promise<Payment[]> {
    const query = supabase.from('payments').select('*').order('created_at', { ascending: false }).limit(100);
    const { data, error } = await (agencyId ? query.eq('agency_id', agencyId) : query.eq('user_id', userId));
    if (error) throw error;
    return (data || []) as Payment[];
  }

  async getPayment(id: string): Promise<Payment | null> {
    const { data, error } = await supabase.from('payments').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return (data as Payment) || null;
  }

  async getInvoices(userId: string, agencyId: string | null): Promise<Invoice[]> {
    const query = supabase.from('invoices').select('*').order('issued_at', { ascending: false }).limit(100);
    const { data, error } = await (agencyId ? query.eq('agency_id', agencyId) : query.eq('user_id', userId));
    if (error) throw error;
    return (data || []) as Invoice[];
  }

  async getPromotions(propertyIds: string[]): Promise<ListingPromotion[]> {
    if (propertyIds.length === 0) return [];
    const { data, error } = await supabase
      .from('listing_promotions')
      .select('*, property:properties(id, title, slug)')
      .in('property_id', propertyIds)
      .neq('status', 'pending_payment')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    return (data || []) as ListingPromotion[];
  }

  // ---------------------------------------------------------------- Checkout (server computes amounts)
  async checkoutSubscription(planId: string, cycle: BillingCycle, provider: CheckoutProvider, agencyId: string | null) {
    const { data, error } = await supabase.rpc('checkout_subscription', {
      p_plan_id: planId, p_cycle: cycle, p_provider: provider, p_agency_id: agencyId,
    });
    if (error) throw error;
    return data as Payment;
  }

  async checkoutRenewal(subscriptionId: string, provider: CheckoutProvider) {
    const { data, error } = await supabase.rpc('checkout_subscription_renewal', {
      p_subscription_id: subscriptionId, p_provider: provider,
    });
    if (error) throw error;
    return data as Payment;
  }

  async checkoutPromotion(kind: PromotionKind, propertyId: string, offerId: string, provider: CheckoutProvider) {
    const { data, error } = await supabase.rpc('checkout_promotion', {
      p_kind: kind, p_property_id: propertyId, p_offer_id: offerId, p_provider: provider,
    });
    if (error) throw error;
    return data as Payment;
  }

  async startTrial(planId: string, cycle: BillingCycle, agencyId: string | null) {
    const { data, error } = await supabase.rpc('start_subscription_trial', {
      p_plan_id: planId, p_cycle: cycle, p_agency_id: agencyId,
    });
    if (error) throw error;
    return data as Subscription;
  }

  async setCancellation(subscriptionId: string, cancel: boolean) {
    const { error } = await supabase.rpc('set_subscription_cancellation', {
      p_subscription_id: subscriptionId, p_cancel: cancel,
    });
    if (error) throw error;
  }

  async redeemCredit(propertyId: string) {
    const { error } = await supabase.rpc('redeem_sponsored_credit', { p_property_id: propertyId });
    if (error) throw error;
  }

  async cancelPayment(paymentId: string) {
    const { error } = await supabase.rpc('cancel_my_payment', { p_payment_id: paymentId });
    if (error) throw error;
  }

  /** Asks the payments Edge Function to start or verify a payment (never trusted client-side). */
  async callPaymentFunction(action: 'start' | 'verify', paymentId: string): Promise<PaymentStartResult> {
    const { data, error } = await supabase.functions.invoke('payments', { body: { action, payment_id: paymentId } });
    if (error) {
      let message = 'Le service de paiement est indisponible.';
      const context = (error as { context?: Response }).context;
      if (context && typeof context.json === 'function') {
        const body = await context.json().catch(() => null) as { error?: string } | null;
        if (body?.error) message = body.error;
      }
      throw new Error(message);
    }
    return data as PaymentStartResult;
  }
}

export const billingService = new BillingService();
