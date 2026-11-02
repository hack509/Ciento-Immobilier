import { supabase } from './supabase';
import type { Profile, Report, UserRole } from '@/types';

export interface AdminStats {
  users: number;
  activeListings: number;
  pendingListings: number;
  openReports: number;
  newsletterSubscribers: number;
}

export interface AdminUsersFilters {
  query?: string;
  role?: UserRole | '';
  page?: number;
  perPage?: number;
}

/** Exact row count without fetching rows; RLS already restricts these tables to admins. */
async function countRows(table: string, match: Record<string, string> = {}) {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .match(match);
  if (error) throw error;
  return count || 0;
}

class AdminService {
  async getStats(): Promise<AdminStats> {
    const [users, activeListings, pendingListings, openReports, newsletterSubscribers] = await Promise.all([
      countRows('profiles'),
      countRows('properties', { status: 'active' }),
      countRows('properties', { status: 'pending' }),
      countRows('reports', { status: 'pending' }),
      countRows('newsletter_subscribers'),
    ]);
    return { users, activeListings, pendingListings, openReports, newsletterSubscribers };
  }

  async getUsers({ query, role, page = 1, perPage = 20 }: AdminUsersFilters = {}) {
    const from = (page - 1) * perPage;
    let request = supabase
      .from('profiles')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + perPage - 1);

    if (role) request = request.eq('role', role);
    if (query) {
      // Strip PostgREST filter syntax characters from free text
      const term = query.replace(/[,()*%]/g, ' ').trim();
      if (term) request = request.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%`);
    }

    const { data, error, count } = await request;
    if (error) throw error;
    return { data: (data || []) as Profile[], count: count || 0, totalPages: Math.ceil((count || 0) / perPage) };
  }

  /** Role, verification and activation changes are enforced server-side (012 trigger). */
  async updateUser(userId: string, changes: Partial<Pick<Profile, 'role' | 'is_active' | 'is_verified'>>) {
    const { data, error } = await supabase
      .from('profiles')
      .update(changes)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data as Profile;
  }

  async getReports(status: Report['status'] | '' = 'pending') {
    let request = supabase
      .from('reports')
      .select('*, reporter:profiles!reports_reporter_id_fkey(id, first_name, last_name, email)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (status) request = request.eq('status', status);

    const { data, error } = await request;
    if (error) throw error;
    return (data || []) as (Report & { reporter?: Pick<Profile, 'id' | 'first_name' | 'last_name' | 'email'> })[];
  }

  async updateReport(id: string, changes: Pick<Report, 'status'> & { admin_notes?: string }) {
    const { error } = await supabase.from('reports').update(changes).eq('id', id);
    if (error) throw error;
  }
}

export const adminService = new AdminService();
