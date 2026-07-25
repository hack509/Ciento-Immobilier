import { useQuery } from '@tanstack/react-query';
import { citiesService } from '@/services/data.service';

export function useCities() {
  return useQuery({
    queryKey: ['cities'],
    queryFn: () => citiesService.getAll(),
    staleTime: 30 * 60 * 1000,
  });
}

export function useNeighborhoods(cityId: string) {
  return useQuery({
    queryKey: ['neighborhoods', cityId],
    queryFn: () => citiesService.getNeighborhoods(cityId),
    enabled: !!cityId,
    staleTime: 30 * 60 * 1000,
  });
}
