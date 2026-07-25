import { useQuery } from '@tanstack/react-query';
import { categoriesService } from '@/services/data.service';

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesService.getAll(),
    staleTime: 30 * 60 * 1000,
  });
}
