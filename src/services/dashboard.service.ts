import { supabase } from './supabase';

export interface UserDashboardStats {
  activeListings: number;
  pendingListings: number;
  favorites: number;
  unreadMessages: number;
}

/** Counts only (head requests); RLS scopes messages to the user's conversations. */
async function count(table: string, match: Record<string, string>, excludeSender?: string) {
  let request = supabase.from(table).select('*', { count: 'exact', head: true }).match(match);
  if (excludeSender) request = request.neq('sender_id', excludeSender);
  const { count: total, error } = await request;
  if (error) throw error;
  return total || 0;
}

class DashboardService {
  async getUserStats(userId: string): Promise<UserDashboardStats> {
    const [activeListings, pendingListings, favorites, unreadMessages] = await Promise.all([
      count('properties', { owner_id: userId, status: 'active' }),
      count('properties', { owner_id: userId, status: 'pending' }),
      count('favorites', { user_id: userId }),
      count('messages', { status: 'unread' }, userId),
    ]);
    return { activeListings, pendingListings, favorites, unreadMessages };
  }
}

export const dashboardService = new DashboardService();
