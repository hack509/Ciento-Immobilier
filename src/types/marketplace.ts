// Types for the marketplace, monetization and administration modules
// (tables created by migrations 016-018).
import type { Agency, Profile, Property } from './index';

export type AgencyMemberRole = 'manager' | 'agent';
export type InquiryStatus = 'new' | 'contacted' | 'qualified' | 'closed' | 'spam';
export type BillingCycle = 'monthly' | 'yearly';
export type SubscriptionStatus = 'pending_payment' | 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired';
export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'cancelled' | 'refunded';
export type PaymentPurpose =
  | 'subscription' | 'subscription_renewal' | 'sponsored_listing' | 'premium_listing' | 'service' | 'advertising';
export type PaymentProvider = 'moncash' | 'card' | 'manual' | 'simulated' | 'credit';
export type PromotionKind = 'sponsored' | 'premium';
export type PromotionStatus = 'pending_payment' | 'scheduled' | 'active' | 'expired' | 'cancelled';
export type ServiceRequestStatus = 'new' | 'in_progress' | 'accepted' | 'completed' | 'cancelled';
export type AdPlacement = 'home_banner' | 'search_inline' | 'property_sidebar' | 'footer_banner';
export type AdSector =
  | 'construction' | 'architecture' | 'materials' | 'developer' | 'finance' | 'insurance' | 'real_estate_services' | 'other';

export interface AgencyMember {
  id: string;
  agency_id: string;
  profile_id: string;
  member_role: AgencyMemberRole;
  title?: string | null;
  can_publish: boolean;
  can_manage_leads: boolean;
  can_manage_billing: boolean;
  is_active: boolean;
  created_at: string;
  profile?: Pick<Profile, 'id' | 'first_name' | 'last_name' | 'email' | 'avatar_url'>;
}

export interface PublicTeamMember {
  id: string;
  agency_id: string;
  profile_id: string;
  member_role: AgencyMemberRole;
  title?: string | null;
  first_name: string;
  last_name: string;
  avatar_url?: string | null;
  bio?: string | null;
}

/** Agency the current user belongs to, with the user's effective rights. */
export interface MyAgency {
  agency: Agency;
  isOwner: boolean;
  role: 'owner' | AgencyMemberRole;
  canPublish: boolean;
  canManageLeads: boolean;
  canManageBilling: boolean;
  canManageTeam: boolean;
}

export interface PropertyInquiry {
  id: string;
  property_id: string;
  recipient_id: string;
  agency_id?: string | null;
  sender_id?: string | null;
  full_name: string;
  email: string;
  phone?: string | null;
  message: string;
  status: InquiryStatus;
  notes?: string | null;
  assigned_to?: string | null;
  created_at: string;
  updated_at: string;
  property?: Pick<Property, 'id' | 'title' | 'slug'> & { city?: { slug: string } | null };
}

export interface SubscriptionPlan {
  id: string;
  code: string;
  name: string;
  tier: 'starter' | 'business' | 'enterprise';
  audience: 'owner' | 'agency' | 'all';
  description?: string | null;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  max_active_listings: number | null;
  featured_credits_per_period: number;
  max_members: number | null;
  trial_days: number;
  features: string[];
  capabilities: Record<string, boolean>;
  is_active: boolean;
  is_public: boolean;
  is_highlighted: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  plan_id: string;
  user_id?: string | null;
  agency_id?: string | null;
  billing_cycle: BillingCycle;
  status: SubscriptionStatus;
  price_amount: number;
  currency: string;
  trial_ends_at?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end: boolean;
  cancelled_at?: string | null;
  featured_credits_remaining: number;
  created_at: string;
  updated_at: string;
  plan?: SubscriptionPlan;
  agency?: Pick<Agency, 'id' | 'name'> | null;
  user?: Pick<Profile, 'id' | 'first_name' | 'last_name' | 'email'> | null;
}

export interface Payment {
  id: string;
  user_id?: string | null;
  agency_id?: string | null;
  purpose: PaymentPurpose;
  reference_id?: string | null;
  amount: number;
  currency: string;
  provider: PaymentProvider;
  provider_reference?: string | null;
  status: PaymentStatus;
  description?: string | null;
  metadata: Record<string, unknown>;
  failure_reason?: string | null;
  confirmed_at?: string | null;
  refunded_at?: string | null;
  expires_at: string;
  created_at: string;
  user?: Pick<Profile, 'id' | 'first_name' | 'last_name' | 'email'> | null;
}

export interface Invoice {
  id: string;
  payment_id: string;
  number: string;
  billing_name?: string | null;
  billing_email?: string | null;
  description: string;
  amount: number;
  currency: string;
  status: 'paid' | 'refunded';
  issued_at: string;
}

export interface PromotionOffer {
  id: string;
  kind: PromotionKind;
  name: string;
  description?: string | null;
  duration_days: number;
  price: number;
  currency: string;
  is_active: boolean;
  sort_order: number;
  updated_at?: string;
}

export interface ListingPromotion {
  id: string;
  kind: PromotionKind;
  property_id: string;
  purchased_by?: string | null;
  agency_id?: string | null;
  offer_id?: string | null;
  payment_id?: string | null;
  subscription_id?: string | null;
  duration_days: number;
  price_paid: number;
  currency: string;
  status: PromotionStatus;
  starts_at?: string | null;
  ends_at?: string | null;
  created_at: string;
  property?: Pick<Property, 'id' | 'title' | 'slug'> | null;
}

export interface ServiceCategory {
  id: string;
  slug: string;
  name: string;
  short_description: string;
  description: string;
  icon?: string | null;
  deliverables: string[];
  starting_price?: number | null;
  currency: string;
  is_active: boolean;
  sort_order: number;
}

export interface ServiceRequest {
  id: string;
  category_id: string;
  user_id?: string | null;
  property_id?: string | null;
  full_name: string;
  email: string;
  phone: string;
  city?: string | null;
  message: string;
  preferred_contact: 'phone' | 'email' | 'whatsapp';
  status: ServiceRequestStatus;
  admin_notes?: string | null;
  created_at: string;
  updated_at: string;
  category?: Pick<ServiceCategory, 'id' | 'name' | 'slug'> | null;
}

export interface AdCampaign {
  id: string;
  advertiser_name: string;
  advertiser_sector: AdSector;
  advertiser_contact?: string | null;
  title: string;
  image_url: string;
  target_url: string;
  alt_text?: string | null;
  placement: AdPlacement;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  priority: number;
  budget_amount?: number | null;
  currency: string;
  impressions_count: number;
  clicks_count: number;
  created_at: string;
}

export type PublicAd = Pick<AdCampaign, 'id' | 'title' | 'image_url' | 'target_url' | 'alt_text' | 'placement' | 'priority' | 'advertiser_name'>;

export interface QuotaSummary {
  limit: number | null;
  used: number;
  member_limit: number | null;
  subscription_id: string | null;
  plan_code: string | null;
  plan_name: string | null;
  capabilities: Record<string, boolean>;
  featured_credits: number;
}

export interface ListingStats {
  totals: { listings: number; active: number; views: number; favorites: number; inquiries: number };
  daily: { day: string; views: number; inquiries: number; favorites: number }[];
  listings: {
    id: string; title: string; slug: string; status: string;
    views_count: number; favorites_count: number; inquiries_count: number;
    sponsored_until: string | null; premium_until: string | null;
  }[];
}

export interface AuditLog {
  id: number;
  actor_id?: string | null;
  actor_role?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
  note?: string | null;
  created_at: string;
}

export interface FinancialReport {
  from: string;
  to: string;
  totals: { currency: string; revenue: number | null; refunded: number | null; payments: number }[];
  by_purpose: { purpose: PaymentPurpose; currency: string; revenue: number; payments: number }[];
  by_month: { month: string; currency: string; revenue: number }[];
  by_provider: { provider: PaymentProvider; revenue: number; payments: number }[];
  recurring: { currency: string; mrr: number; subscriptions: number }[];
  failed_payments: number;
}

export interface MarketplaceStats {
  agencies_total: number;
  agencies_pending: number;
  subscriptions_active: number;
  payments_pending: number;
  promotions_active: number;
  service_requests_new: number;
  ad_campaigns_live: number;
  revenue_month: number;
  inquiries_week: number;
}
