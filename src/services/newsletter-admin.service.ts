import { supabase } from './supabase';
import { functionError } from './inbox.service';
import { sanitizeSearchTerm } from '@/lib/monetization';

export type SubscriberStatus = 'pending' | 'active' | 'unsubscribed' | 'suspended';

export interface Subscriber {
  id: string;
  email: string;
  status: SubscriberStatus;
  source: string;
  consented_at?: string | null;
  confirmed_at?: string | null;
  unsubscribed_at?: string | null;
  suspended_reason?: string | null;
  archived_at?: string | null;
  created_at: string;
}

export interface ConsentEvent { id: number; event: string; source?: string | null; ip_hash?: string | null; user_agent?: string | null; created_at: string }

export interface Campaign {
  id: string;
  subject: string;
  preheader?: string | null;
  content: string;
  status: 'draft' | 'sending' | 'sent' | 'partially_sent' | 'failed' | 'cancelled';
  recipients_count: number;
  sent_count: number;
  delivered_count: number;
  opened_count: number;
  clicked_count: number;
  bounced_count: number;
  failed_count: number;
  provider?: string | null;
  last_error?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
}

export interface SubscriberFilters {
  status: SubscriberStatus | '' | 'archived';
  search: string;
  from?: string;
  to?: string;
  page: number;
}

export const SUBSCRIBER_PAGE_SIZE = 25;

function applyFilters<T extends { eq: Function; is: Function; not: Function; gte: Function; lt: Function; or: Function }>(query: T, f: Omit<SubscriberFilters, 'page'>): T {
  let q = query;
  if (f.status === 'archived') q = q.not('archived_at', 'is', null);
  else {
    q = q.is('archived_at', null);
    if (f.status) q = q.eq('status', f.status);
  }
  if (f.from) q = q.gte('created_at', f.from);
  if (f.to) q = q.lt('created_at', new Date(new Date(f.to).getTime() + 86_400_000).toISOString());
  const term = sanitizeSearchTerm(f.search);
  if (term) q = q.or(`email.ilike.%${term}%`);
  return q;
}

class NewsletterAdminService {
  async stats() {
    const { data, error } = await supabase.rpc('admin_newsletter_stats');
    if (error) throw error;
    return data as Record<'total' | 'active' | 'pending' | 'unsubscribed' | 'suspended' | 'archived' | 'new_30_days', number>;
  }

  async list(filters: SubscriberFilters) {
    const from = (filters.page - 1) * SUBSCRIBER_PAGE_SIZE;
    const base = supabase.from('newsletter_subscribers').select('*', { count: 'exact' })
      .order('created_at', { ascending: false }).range(from, from + SUBSCRIBER_PAGE_SIZE - 1);
    const { data, error, count } = await applyFilters(base, filters);
    if (error) throw error;
    return { data: (data || []) as Subscriber[], count: count || 0, totalPages: Math.max(1, Math.ceil((count || 0) / SUBSCRIBER_PAGE_SIZE)) };
  }

  /** Every matching row (1 000 per request) for the CSV export. */
  async listAll(filters: Omit<SubscriberFilters, 'page'>): Promise<Subscriber[]> {
    const rows: Subscriber[] = [];
    for (let from = 0; from < 100_000; from += 1000) {
      const base = supabase.from('newsletter_subscribers').select('*').order('created_at', { ascending: false }).range(from, from + 999);
      const { data, error } = await applyFilters(base, filters);
      if (error) throw error;
      rows.push(...((data || []) as Subscriber[]));
      if (!data || data.length < 1000) break;
    }
    return rows;
  }

  async consentEvents(subscriberId: string): Promise<ConsentEvent[]> {
    const { data, error } = await supabase.from('newsletter_consent_events').select('*')
      .eq('subscriber_id', subscriberId).order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as ConsentEvent[];
  }

  async update(id: string, changes: Partial<Pick<Subscriber, 'status' | 'suspended_reason' | 'archived_at'>>) {
    const { error } = await supabase.from('newsletter_subscribers').update(changes).eq('id', id);
    if (error) throw error;
  }

  /** Right to erasure: removes the address and its consent history. */
  async remove(id: string) {
    const { error } = await supabase.from('newsletter_subscribers').delete().eq('id', id);
    if (error) throw error;
  }

  // ---------------------------------------------------------------- Campaigns
  async campaigns(): Promise<Campaign[]> {
    const { data, error } = await supabase.from('newsletter_campaigns').select('*').order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    return (data || []) as Campaign[];
  }

  async saveCampaign(campaign: Pick<Campaign, 'subject' | 'content'> & { id?: string; preheader?: string | null }) {
    const values = { subject: campaign.subject.trim(), preheader: campaign.preheader?.trim() || null, content: campaign.content.trim() };
    const { error } = campaign.id
      ? await supabase.from('newsletter_campaigns').update(values).eq('id', campaign.id)
      : await supabase.from('newsletter_campaigns').insert(values);
    if (error) throw error;
  }

  async deleteCampaign(id: string) {
    const { error } = await supabase.from('newsletter_campaigns').delete().eq('id', id);
    if (error) throw error;
  }

  async providerStatus(): Promise<{ configured: boolean; provider: string | null }> {
    const { data, error } = await supabase.functions.invoke('admin-mail', { body: { action: 'status' } });
    if (error) return { configured: false, provider: null };
    return data as { configured: boolean; provider: string | null };
  }

  async sendTest(id: string): Promise<string> {
    const { data, error } = await supabase.functions.invoke('admin-mail', { body: { action: 'test_campaign', campaign_id: id } });
    if (error) throw new Error(await functionError(error, 'Envoi du test impossible.'));
    return (data as { to: string }).to;
  }

  /** Sends batch after batch until nothing is left (each call is time-boxed server-side). */
  async send(id: string, onProgress: (s: { remaining: number; sent: number; failed: number }) => void) {
    for (let i = 0; i < 200; i++) {
      const { data, error } = await supabase.functions.invoke('admin-mail', { body: { action: 'send_campaign', campaign_id: id } });
      if (error) throw new Error(await functionError(error, 'Envoi interrompu.'));
      const summary = data as { remaining: number; sent: number; failed: number };
      onProgress(summary);
      if (summary.remaining === 0) return summary;
    }
    throw new Error('Envoi interrompu : relancez l’envoi pour terminer.');
  }
}

export const newsletterAdminService = new NewsletterAdminService();
