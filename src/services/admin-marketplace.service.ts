import { supabase } from './supabase';
import type { Agency, SiteSettings } from '@/types';
import type {
  AdCampaign, AuditLog, FinancialReport, ListingPromotion, MarketplaceStats, Payment, PaymentStatus, PromotionOffer,
  ServiceCategory, ServiceRequest, ServiceRequestStatus, Subscription, SubscriptionPlan,
} from '@/types/marketplace';

/** Admin back-office for the marketplace. Every call is enforced by RLS / is_admin() server-side. */
class AdminMarketplaceService {
  async getStats(): Promise<MarketplaceStats> {
    const { data, error } = await supabase.rpc('admin_marketplace_stats');
    if (error) throw error;
    return data as MarketplaceStats;
  }

  // ---------------------------------------------------------------- Agencies
  async getAgencies(filter: 'pending' | 'verified' | 'suspended' | '' = ''): Promise<(Agency & { owner?: { email: string; first_name: string; last_name: string } })[]> {
    let query = supabase
      .from('agencies')
      .select('*, owner:profiles!agencies_owner_id_fkey(email, first_name, last_name)')
      .order('created_at', { ascending: false })
      .limit(200);
    if (filter === 'pending') query = query.eq('is_verified', false).eq('is_active', true);
    if (filter === 'verified') query = query.eq('is_verified', true).eq('is_active', true);
    if (filter === 'suspended') query = query.eq('is_active', false);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as (Agency & { owner?: { email: string; first_name: string; last_name: string } })[];
  }

  async setAgencyStatus(agencyId: string, verified: boolean, active: boolean, note?: string) {
    const { error } = await supabase.rpc('admin_set_agency_status', {
      p_agency_id: agencyId, p_verified: verified, p_active: active, p_note: note || null,
    });
    if (error) throw error;
  }

  // ---------------------------------------------------------------- Plans & subscriptions
  async getAllPlans(): Promise<SubscriptionPlan[]> {
    const { data, error } = await supabase.from('subscription_plans').select('*').order('sort_order');
    if (error) throw error;
    return (data || []) as SubscriptionPlan[];
  }

  async savePlan(plan: Partial<SubscriptionPlan> & { id?: string }) {
    const { id, created_at: _c, updated_at: _u, ...values } = plan;
    const request = id
      ? supabase.from('subscription_plans').update(values).eq('id', id)
      : supabase.from('subscription_plans').insert(values);
    const { error } = await request;
    if (error) throw error;
  }

  async getSubscriptions(status: string): Promise<Subscription[]> {
    let query = supabase
      .from('subscriptions')
      .select(`*, plan:subscription_plans(id, name, code),
               agency:agencies(id, name),
               user:profiles!subscriptions_user_id_fkey(id, first_name, last_name, email)`)
      .order('created_at', { ascending: false })
      .limit(200);
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as Subscription[];
  }

  // ---------------------------------------------------------------- Payments
  async getPayments(status: PaymentStatus | ''): Promise<Payment[]> {
    let query = supabase
      .from('payments')
      .select('*, user:profiles!payments_user_id_fkey(id, first_name, last_name, email)')
      .order('created_at', { ascending: false })
      .limit(200);
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as Payment[];
  }

  async confirmPayment(paymentId: string, reference: string, note?: string) {
    const { error } = await supabase.rpc('admin_confirm_payment', {
      p_payment_id: paymentId, p_reference: reference, p_note: note || null,
    });
    if (error) throw error;
  }

  async refundPayment(paymentId: string, reason: string) {
    const { error } = await supabase.rpc('admin_refund_payment', { p_payment_id: paymentId, p_reason: reason });
    if (error) throw error;
  }

  // ---------------------------------------------------------------- Promotions
  async getAllOffers(): Promise<PromotionOffer[]> {
    const { data, error } = await supabase.from('promotion_offers').select('*').order('kind').order('duration_days');
    if (error) throw error;
    return (data || []) as PromotionOffer[];
  }

  async saveOffer(offer: Partial<PromotionOffer> & { id?: string }) {
    const { id, ...values } = offer;
    const request = id
      ? supabase.from('promotion_offers').update(values).eq('id', id)
      : supabase.from('promotion_offers').insert(values);
    const { error } = await request;
    if (error) throw error;
  }

  async getPromotions(status: string): Promise<ListingPromotion[]> {
    let query = supabase
      .from('listing_promotions')
      .select('*, property:properties(id, title, slug)')
      .order('created_at', { ascending: false })
      .limit(200);
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as ListingPromotion[];
  }

  async cancelPromotion(id: string, reason: string) {
    const { error } = await supabase.rpc('admin_cancel_promotion', { p_promotion_id: id, p_reason: reason });
    if (error) throw error;
  }

  // ---------------------------------------------------------------- Services
  async getServiceCategories(): Promise<ServiceCategory[]> {
    const { data, error } = await supabase.from('service_categories').select('*').order('sort_order');
    if (error) throw error;
    return (data || []) as ServiceCategory[];
  }

  async saveServiceCategory(category: Partial<ServiceCategory> & { id: string }) {
    const { id, ...values } = category;
    const { error } = await supabase.from('service_categories').update(values).eq('id', id);
    if (error) throw error;
  }

  async getServiceRequests(status: ServiceRequestStatus | ''): Promise<ServiceRequest[]> {
    let query = supabase
      .from('service_requests')
      .select('*, category:service_categories(id, name, slug)')
      .order('created_at', { ascending: false })
      .limit(200);
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as ServiceRequest[];
  }

  async updateServiceRequest(id: string, changes: { status?: ServiceRequestStatus; admin_notes?: string | null }) {
    const { error } = await supabase.from('service_requests').update(changes).eq('id', id);
    if (error) throw error;
  }

  // ---------------------------------------------------------------- Advertising
  async getCampaigns(): Promise<AdCampaign[]> {
    const { data, error } = await supabase
      .from('advertising_campaigns')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    return (data || []) as AdCampaign[];
  }

  async saveCampaign(campaign: Partial<AdCampaign> & { id?: string }) {
    const { id, impressions_count: _i, clicks_count: _c, created_at: _d, ...values } = campaign;
    const request = id
      ? supabase.from('advertising_campaigns').update(values).eq('id', id)
      : supabase.from('advertising_campaigns').insert(values);
    const { error } = await request;
    if (error) throw error;
  }

  async deleteCampaign(id: string) {
    const { error } = await supabase.from('advertising_campaigns').delete().eq('id', id);
    if (error) throw error;
  }

  async uploadAdBanner(file: File): Promise<string> {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Format accepté : JPEG, PNG ou WebP.');
    if (file.size > 2 * 1024 * 1024) throw new Error('Image trop volumineuse (2 Mo maximum).');
    const path = `ads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${file.type.split('/')[1]}`;
    const { error } = await supabase.storage.from('brand-assets').upload(path, file, { contentType: file.type });
    if (error) throw error;
    return supabase.storage.from('brand-assets').getPublicUrl(path).data.publicUrl;
  }

  // ---------------------------------------------------------------- Reports, settings, audit
  async getFinancialReport(from: string, to: string): Promise<FinancialReport> {
    const { data, error } = await supabase.rpc('admin_financial_report', { p_from: from, p_to: to });
    if (error) throw error;
    return data as FinancialReport;
  }

  async getSettings(): Promise<SiteSettings[]> {
    const { data, error } = await supabase.from('site_settings').select('*').order('key');
    if (error) throw error;
    return (data || []) as SiteSettings[];
  }

  /** site_settings writes are restricted to super_admin by RLS. */
  async updateSetting(key: string, value: unknown) {
    const { data, error } = await supabase.from('site_settings').update({ value }).eq('key', key).select('key');
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('Seul un super administrateur peut modifier les paramètres.');
  }

  async getAuditLogs(entityType: string): Promise<AuditLog[]> {
    let query = supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200);
    if (entityType) query = query.eq('entity_type', entityType);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as AuditLog[];
  }

  async runMaintenance() {
    const { data, error } = await supabase.rpc('run_marketplace_maintenance');
    if (error) throw error;
    return data as Record<string, unknown>;
  }
}

export const adminMarketplaceService = new AdminMarketplaceService();
