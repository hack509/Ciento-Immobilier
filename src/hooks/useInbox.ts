import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { inboxService, type ContactSource, type InboxFilter } from '@/services/inbox.service';

export function useInboxCounts(enabled = true) {
  return useQuery({
    queryKey: ['admin', 'inbox', 'counts'],
    queryFn: () => inboxService.counts(),
    enabled,
    staleTime: 15_000,
    refetchInterval: 60_000, // fallback when Realtime is not enabled on the project
  });
}

export function useInboxList(filter: InboxFilter, search: string, page: number, source: ContactSource | '') {
  return useQuery({
    queryKey: ['admin', 'inbox', 'list', filter, search, page, source],
    queryFn: () => inboxService.list(filter, search, page, source),
    placeholderData: (previous) => previous,
    refetchInterval: 60_000,
  });
}

/**
 * Live updates: a new message refreshes the list and the unread badge without
 * reloading the page (Supabase Realtime; RLS still applies to the payload).
 */
export function useInboxRealtime(enabled: boolean, onNew?: (subject: string) => void) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel('admin-contact-inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contact_messages' }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['admin', 'inbox'] });
        if (payload.eventType === 'INSERT') {
          const row = payload.new as { subject?: string; source?: string };
          if (row.source !== 'property') onNew?.(row.subject ?? 'Nouveau message');
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [enabled, onNew, queryClient]);
}
