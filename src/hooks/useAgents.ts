import { useQuery } from '@tanstack/react-query';
import { agentsService } from '@/services/data.service';

export function useAgents(limit?: number) {
  return useQuery({
    queryKey: ['agents', limit],
    queryFn: () => agentsService.getAll(limit),
    staleTime: 5 * 60 * 1000,
  });
}
