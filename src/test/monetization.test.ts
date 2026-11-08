import { describe, expect, it } from 'vitest';
import {
  canPublishMore, daysLeft, errorMessage, isActiveUntil, isListingAvailable, isPremium, isSponsored, planPrice,
  prorationCredit, quotaRatio, sanitizeSearchTerm, statusTone, yearlySavingPercent, isAdminRole,
} from '@/lib/monetization';

const NOW = new Date('2026-11-07T12:00:00Z');
const inDays = (d: number) => new Date(NOW.getTime() + d * 86_400_000).toISOString();

describe('paid visibility', () => {
  it('a promotion is active only while its end date is in the future', () => {
    expect(isActiveUntil(inDays(3), NOW)).toBe(true);
    expect(isActiveUntil(inDays(-1), NOW)).toBe(false);
    expect(isActiveUntil(null, NOW)).toBe(false);
    expect(isActiveUntil('not-a-date', NOW)).toBe(false);
  });

  it('expired sponsorship no longer shows the badge (automatic expiry on the client)', () => {
    expect(isSponsored({ sponsored_until: inDays(-0.01) }, NOW)).toBe(false);
    expect(isPremium({ premium_until: inDays(15) }, NOW)).toBe(true);
  });

  it('counts remaining days rounded up', () => {
    expect(daysLeft(inDays(6.2), NOW)).toBe(7);
    expect(daysLeft(inDays(-2), NOW)).toBe(0);
  });

  it('only validated live listings are available / indexable', () => {
    expect(isListingAvailable({ status: 'active', is_published: true })).toBe(true);
    expect(isListingAvailable({ status: 'sold', is_published: true })).toBe(false);
    expect(isListingAvailable({ status: 'pending', is_published: false })).toBe(false);
    expect(isListingAvailable({ status: 'expired', is_published: true })).toBe(false);
  });
});

describe('plans & quotas (values always come from the database)', () => {
  const plan = { price_monthly: 2500, price_yearly: 25000 };

  it('selects the price of the billing cycle', () => {
    expect(planPrice(plan, 'monthly')).toBe(2500);
    expect(planPrice(plan, 'yearly')).toBe(25000);
  });

  it('computes the yearly saving percentage', () => {
    expect(yearlySavingPercent(plan)).toBe(17);
    expect(yearlySavingPercent({ price_monthly: 0, price_yearly: 0 })).toBe(0);
    expect(yearlySavingPercent({ price_monthly: 100, price_yearly: 1500 })).toBe(0);
  });

  it('enforces listing limits in the UI (null = unlimited)', () => {
    expect(canPublishMore(2, 3)).toBe(true);
    expect(canPublishMore(3, 3)).toBe(false);
    expect(canPublishMore(500, null)).toBe(true);
    expect(quotaRatio(5, 10)).toBe(0.5);
    expect(quotaRatio(12, 10)).toBe(1);
    expect(quotaRatio(3, null)).toBe(0);
  });

  it('mirrors the server-side proration on plan change', () => {
    const start = inDays(-15);
    const end = inDays(15);
    expect(prorationCredit(3000, start, end, NOW)).toBe(1500);
    expect(prorationCredit(3000, start, inDays(-1), NOW)).toBe(0);
    expect(prorationCredit(3000, null, end, NOW)).toBe(0);
  });
});

describe('roles', () => {
  it('only admin and super_admin are administrators', () => {
    expect(isAdminRole('admin')).toBe(true);
    expect(isAdminRole('super_admin')).toBe(true);
    for (const role of ['agency', 'agent', 'owner', 'client'] as const) expect(isAdminRole(role)).toBe(false);
    expect(isAdminRole(undefined)).toBe(false);
  });
});

describe('input hardening', () => {
  it('strips PostgREST filter syntax from free-text search', () => {
    const injected = 'maison,status.eq.draft),owner_id.neq.(x';
    const clean = sanitizeSearchTerm(injected);
    expect(clean).not.toMatch(/[,()]/);
    expect(clean).not.toContain('.');
    expect(sanitizeSearchTerm('  Villa   Gonaïves ')).toBe('Villa Gonaïves');
    expect(sanitizeSearchTerm('a'.repeat(200))).toHaveLength(80);
  });

  it('never leaks raw database errors for permission problems', () => {
    expect(errorMessage({ message: 'new row violates row-level security policy for table "payments"' })).toBe('Action non autorisée.');
    expect(errorMessage({ message: 'permission denied for function confirm_payment' })).toBe('Action non autorisée.');
    expect(errorMessage({ message: 'Limite de 3 annonce(s) atteinte pour votre formule.' })).toContain('Limite de 3');
    expect(errorMessage(null, 'Défaut')).toBe('Défaut');
  });

  it('maps statuses to visual tones', () => {
    expect(statusTone('succeeded')).toBe('success');
    expect(statusTone('pending_payment')).toBe('warning');
    expect(statusTone('failed')).toBe('danger');
    expect(statusTone('unknown')).toBe('default');
  });
});
