// Pure helpers for monetization & marketplace UI. No prices or limits are
// hard-coded here: they always come from the database (subscription_plans,
// promotion_offers, site_settings).
import type { Property, UserRole } from '@/types';
import type {
  BillingCycle, InquiryStatus, PaymentProvider, PaymentPurpose, PaymentStatus, PromotionStatus,
  ServiceRequestStatus, SubscriptionPlan, SubscriptionStatus, AdPlacement, AdSector,
} from '@/types/marketplace';

/** A paid visibility option is active while its end date is in the future. */
export function isActiveUntil(until: string | null | undefined, now: Date = new Date()): boolean {
  if (!until) return false;
  const end = new Date(until).getTime();
  return !Number.isNaN(end) && end > now.getTime();
}

export function isSponsored(property: Pick<Property, 'sponsored_until'>, now?: Date): boolean {
  return isActiveUntil(property.sponsored_until, now);
}

export function isPremium(property: Pick<Property, 'premium_until'>, now?: Date): boolean {
  return isActiveUntil(property.premium_until, now);
}

/** Remaining whole days (rounded up) before a date; 0 when past. */
export function daysLeft(until: string | null | undefined, now: Date = new Date()): number {
  if (!until) return 0;
  const ms = new Date(until).getTime() - now.getTime();
  return ms > 0 ? Math.ceil(ms / 86_400_000) : 0;
}

/** Public visibility rule: only validated, live listings are indexable/available. */
export function isListingAvailable(property: Pick<Property, 'status' | 'is_published'>): boolean {
  return property.is_published && property.status === 'active';
}

export function planPrice(plan: Pick<SubscriptionPlan, 'price_monthly' | 'price_yearly'>, cycle: BillingCycle): number {
  return Number(cycle === 'yearly' ? plan.price_yearly : plan.price_monthly);
}

/** Yearly saving vs. 12 monthly payments, in percent (0 when none). */
export function yearlySavingPercent(plan: Pick<SubscriptionPlan, 'price_monthly' | 'price_yearly'>): number {
  const monthlyTotal = Number(plan.price_monthly) * 12;
  if (monthlyTotal <= 0 || Number(plan.price_yearly) <= 0) return 0;
  const saving = 1 - Number(plan.price_yearly) / monthlyTotal;
  return saving > 0 ? Math.round(saving * 100) : 0;
}

export function formatLimit(limit: number | null | undefined, unit: string): string {
  if (limit === null || limit === undefined) return `${unit} illimité(e)s`;
  return `${limit} ${unit}`;
}

/** Usage ratio for progress bars (null limit = unlimited → 0). */
export function quotaRatio(used: number, limit: number | null | undefined): number {
  if (limit === null || limit === undefined || limit <= 0) return limit === 0 ? 1 : 0;
  return Math.min(used / limit, 1);
}

export function canPublishMore(used: number, limit: number | null | undefined): boolean {
  return limit === null || limit === undefined || used < limit;
}

/** Mirrors the database proration (checkout_subscription) for display only. */
export function prorationCredit(
  paidAmount: number, periodStart: string | null | undefined, periodEnd: string | null | undefined, now: Date = new Date(),
): number {
  if (!periodStart || !periodEnd) return 0;
  const start = new Date(periodStart).getTime();
  const end = new Date(periodEnd).getTime();
  const total = end - start;
  if (total <= 0) return 0;
  const remaining = Math.max(end - now.getTime(), 0);
  return Math.round(paidAmount * (remaining / total) * 100) / 100;
}

export function isAdminRole(role: UserRole | undefined | null): boolean {
  return role === 'admin' || role === 'super_admin';
}

/**
 * Mapping between the specification roles and the database roles.
 * visitor = anonymous, agency_member = 'agent' role or an agency_members row.
 */
export const SPEC_ROLE_LABELS: Record<string, string> = {
  visitor: 'Visiteur',
  owner: 'Propriétaire',
  agency: 'Agence',
  agency_member: 'Membre d’agence',
  admin: 'Administrateur',
  super_admin: 'Super administrateur',
};

export const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = {
  monthly: 'Mensuel',
  yearly: 'Annuel',
};

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  pending_payment: 'En attente de paiement',
  trialing: 'Période d’essai',
  active: 'Actif',
  past_due: 'Paiement en retard',
  cancelled: 'Annulé',
  expired: 'Expiré',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'En attente',
  succeeded: 'Payé',
  failed: 'Échoué',
  cancelled: 'Annulé',
  refunded: 'Remboursé',
};

export const PAYMENT_PURPOSE_LABELS: Record<PaymentPurpose, string> = {
  subscription: 'Abonnement',
  subscription_renewal: 'Renouvellement',
  sponsored_listing: 'Annonce sponsorisée',
  premium_listing: 'Option Premium',
  service: 'Service immobilier',
  advertising: 'Publicité',
};

export const PAYMENT_PROVIDER_LABELS: Record<PaymentProvider, string> = {
  moncash: 'MonCash',
  card: 'Carte bancaire',
  manual: 'Virement / espèces',
  simulated: 'Simulation (dev)',
  credit: 'Crédit de formule',
};

export const PROMOTION_STATUS_LABELS: Record<PromotionStatus, string> = {
  pending_payment: 'En attente de paiement',
  scheduled: 'Programmée',
  active: 'En cours',
  expired: 'Terminée',
  cancelled: 'Annulée',
};

export const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  new: 'Nouveau',
  contacted: 'Contacté',
  qualified: 'Qualifié',
  closed: 'Clôturé',
  spam: 'Indésirable',
};

export const SERVICE_STATUS_LABELS: Record<ServiceRequestStatus, string> = {
  new: 'Nouvelle',
  in_progress: 'En traitement',
  accepted: 'Acceptée',
  completed: 'Terminée',
  cancelled: 'Annulée',
};

export const AD_PLACEMENT_LABELS: Record<AdPlacement, string> = {
  home_banner: 'Accueil — bannière',
  search_inline: 'Résultats de recherche',
  property_sidebar: 'Fiche annonce — colonne',
  footer_banner: 'Pied de page',
};

export const AD_SECTOR_LABELS: Record<AdSector, string> = {
  construction: 'Construction',
  architecture: 'Architecture',
  materials: 'Matériaux',
  developer: 'Promotion immobilière',
  finance: 'Institution financière',
  insurance: 'Assurance',
  real_estate_services: 'Services immobiliers',
  other: 'Autre',
};

export type Tone = 'success' | 'warning' | 'danger' | 'primary' | 'default' | 'secondary';

export function statusTone(status: string): Tone {
  switch (status) {
    case 'active': case 'succeeded': case 'paid': case 'completed': case 'accepted': case 'qualified':
      return 'success';
    case 'pending': case 'pending_payment': case 'trialing': case 'scheduled': case 'new': case 'in_progress':
      return 'warning';
    case 'failed': case 'past_due': case 'spam':
      return 'danger';
    case 'refunded': case 'contacted':
      return 'primary';
    default:
      return 'default';
  }
}

/** Turns a Supabase/PostgREST error into a user-facing French message. */
export function errorMessage(error: unknown, fallback = 'Une erreur est survenue. Veuillez réessayer.'): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message: unknown }).message);
    if (/permission denied|row-level security|42501/i.test(message)) return 'Action non autorisée.';
    if (/JWT|not authenticated/i.test(message)) return 'Votre session a expiré. Reconnectez-vous.';
    if (message && !/^[a-z_]+$/.test(message) && message.length < 300) return message;
  }
  return fallback;
}

/** Removes PostgREST filter syntax from free text before it is used in .or(). */
export function sanitizeSearchTerm(term: string): string {
  return term.replace(/[,()*%\\:."']/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}
