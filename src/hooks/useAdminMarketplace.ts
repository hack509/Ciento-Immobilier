import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';

/** Read helper for admin pages; every key lives under ['admin', ...]. */
export function useAdminQuery<T>(key: unknown[], queryFn: () => Promise<T>, enabled = true) {
  return useQuery({
    queryKey: ['admin', ...key],
    queryFn,
    enabled,
    placeholderData: keepPreviousData,
  });
}

/** Write helper: refreshes every admin query (and public catalogues) on success. */
export function useAdminMutation<TVars, TResult = unknown>(mutationFn: (vars: TVars) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({ queryKey: ['offers'] });
      queryClient.invalidateQueries({ queryKey: ['service-categories'] });
      queryClient.invalidateQueries({ queryKey: ['ads'] });
    },
  });
}
