import { useQuery } from '@tanstack/react-query';
import { agenciesService } from '@/services/data.service';

export function useAgencies(limit?: number) {
  return useQuery({
    queryKey: ['agencies', limit],
    queryFn: () => agenciesService.getAll(limit),
    staleTime: 5 * 60 * 1000,
  });
}
