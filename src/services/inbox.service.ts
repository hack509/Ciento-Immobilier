import { supabase } from './supabase';
import { sanitizeSearchTerm } from '@/lib/monetization';

export type ContactStatus = 'pending' | 'in_progress' | 'replied' | 'resolved' | 'archived';
export type ContactSource = 'contact_page' | 'property' | 'agency' | 'service' | 'other';
export type InboxFilter = 'all' | 'unread' | 'read' | ContactStatus;

export interface ContactMessage {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  subject: string;
  message: string;
  source: ContactSource;
  property_id?: string | null;
  agency_id?: string | null;
  related_id?: string | null;
  status: ContactStatus;
  read_at?: string | null;
  assigned_to?: string | null;
  replied_at?: string | null;
  created_at: string;
  property?: { id: string; title: string; slug: string; city?: { slug: string } | null } | null;
  agency?: { id: string; name: string; slug: string } | null;
}

export interface ContactNote { id: string; body: string; created_at: string; author?: { first_name: string; last_name: string } | null }
export interface ContactHistory { id: number; action: string; from_status?: string | null; to_status?: string | null; details?: Record<string, unknown> | null; created_at: string; actor?: { first_name: string; last_name: string } | null }
export type InboxCounts = Record<'all' | 'unread' | 'read' | 'pending' | 'in_progress' | 'replied' | 'archived', number>;

export interface ContactInput {
  fullName: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  source?: 'contact_page' | 'agency' | 'other';
  propertyId?: string | null;
  agencyId?: string | null;
}

const PAGE_SIZE = 25;

class InboxService {
  /** Public: every contact form posts here (stored in the database, never e-mail only). */
  async submit(input: ContactInput): Promise<string> {
    const { data, error } = await supabase.rpc('submit_contact_message', {
      p_full_name: input.fullName.trim(),
      p_email: input.email.trim(),
      p_phone: input.phone?.trim() || null,
      p_subject: input.subject.trim(),
      p_message: input.message.trim(),
      p_source: input.source ?? 'contact_page',
      p_property_id: input.propertyId ?? null,
      p_agency_id: input.agencyId ?? null,
    });
    if (error) throw error;
    return data as string;
  }

  // ---------------------------------------------------------------- Admin
  async list(filter: InboxFilter, search: string, page: number, source?: ContactSource | '') {
    const from = (page - 1) * PAGE_SIZE;
    let query = supabase
      .from('contact_messages')
      .select('*, property:properties(id, title, slug, city:cities!properties_city_id_fkey(slug)), agency:agencies(id, name, slug)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (filter === 'unread') query = query.is('read_at', null).neq('status', 'archived');
    else if (filter === 'read') query = query.not('read_at', 'is', null).neq('status', 'archived');
    else if (filter === 'replied') query = query.in('status', ['replied', 'resolved']);
    else if (filter === 'all') query = query.neq('status', 'archived');
    else query = query.eq('status', filter);
    if (source) query = query.eq('source', source);
    const term = sanitizeSearchTerm(search);
    if (term) query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,subject.ilike.%${term}%`);
    const { data, error, count } = await query;
    if (error) throw error;
    return { data: (data || []) as ContactMessage[], count: count || 0, totalPages: Math.max(1, Math.ceil((count || 0) / PAGE_SIZE)) };
  }

  async get(id: string): Promise<ContactMessage | null> {
    const { data, error } = await supabase
      .from('contact_messages')
      .select('*, property:properties(id, title, slug, city:cities!properties_city_id_fkey(slug)), agency:agencies(id, name, slug)')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return (data as unknown as ContactMessage | null) ?? null;
  }

  async counts(): Promise<InboxCounts> {
    const { data, error } = await supabase.rpc('admin_inbox_counts');
    if (error) throw error;
    return data as InboxCounts;
  }

  async details(id: string) {
    const [notes, history] = await Promise.all([
      supabase.from('contact_message_notes').select('id, body, created_at, author:profiles!contact_message_notes_author_id_fkey(first_name, last_name)')
        .eq('message_id', id).order('created_at'),
      supabase.from('contact_message_history').select('id, action, from_status, to_status, details, created_at, actor:profiles!contact_message_history_actor_id_fkey(first_name, last_name)')
        .eq('message_id', id).order('created_at', { ascending: false }).limit(50),
    ]);
    if (notes.error) throw notes.error;
    if (history.error) throw history.error;
    return { notes: (notes.data || []) as unknown as ContactNote[], history: (history.data || []) as unknown as ContactHistory[] };
  }

  async update(id: string, changes: Partial<{ status: ContactStatus; read_at: string | null; assigned_to: string | null }>) {
    const { error } = await supabase.from('contact_messages').update(changes).eq('id', id);
    if (error) throw error;
  }

  async addNote(id: string, body: string) {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('contact_message_notes').insert({ message_id: id, body: body.trim(), author_id: user?.id });
    if (error) throw error;
  }

  /** Deletion is reserved to super administrators (RLS). */
  async remove(id: string) {
    const { data, error } = await supabase.from('contact_messages').delete().eq('id', id).select('id');
    if (error) throw error;
    if (!data?.length) throw new Error('Seul un super administrateur peut supprimer un message. Archivez-le plutôt.');
  }

  async admins(): Promise<{ id: string; first_name: string; last_name: string }[]> {
    const { data, error } = await supabase.from('profiles').select('id, first_name, last_name')
      .in('role', ['admin', 'super_admin']).eq('is_active', true).order('first_name');
    if (error) throw error;
    return (data || []) as { id: string; first_name: string; last_name: string }[];
  }

  /** Direct reply through the configured e-mail provider (admin-mail Edge Function). */
  async replyByEmail(id: string, subject: string, body: string) {
    const { error } = await supabase.functions.invoke('admin-mail', { body: { action: 'reply_contact', message_id: id, subject, body } });
    if (error) throw new Error(await functionError(error, 'Envoi impossible.'));
  }
}

export async function functionError(error: unknown, fallback: string): Promise<string> {
  const context = (error as { context?: Response }).context;
  if (context && typeof context.json === 'function') {
    const payload = await context.json().catch(() => null) as { error?: string } | null;
    if (payload?.error) return payload.error;
  }
  return fallback;
}

/** mailto: link for a reply from the admin's own mail client (nothing is marked as sent). */
export function buildReplyMailto(message: Pick<ContactMessage, 'email' | 'subject' | 'full_name' | 'message' | 'created_at'>, signature = 'L’équipe CIENTO-IMMOBILIER'): string {
  const subject = /^re\s*:/i.test(message.subject) ? message.subject : `Re: ${message.subject}`;
  const quoted = message.message.split('\n').map((l) => `> ${l}`).join('\n');
  const body = `Bonjour ${message.full_name},\n\n\n\n${signature}\n\n— Message du ${new Date(message.created_at).toLocaleDateString('fr-FR')} :\n${quoted}`;
  // Keep under typical mailto length limits.
  return `mailto:${encodeURIComponent(message.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.slice(0, 1800))}`;
}

export const inboxService = new InboxService();
