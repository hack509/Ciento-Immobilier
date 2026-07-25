import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { favoritesService } from '@/services/favorites.service';

export function useFavorites() {
  return useQuery({
    queryKey: ['favorites'],
    queryFn: () => favoritesService.getAll(),
    staleTime: 1 * 60 * 1000,
  });
}

export function useFavoriteStatus(propertyId: string) {
  return useQuery({
    queryKey: ['favorites', 'check', propertyId],
    queryFn: () => favoritesService.check(propertyId),
    enabled: !!propertyId,
    staleTime: 30 * 1000,
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (propertyId: string) => favoritesService.toggle(propertyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
  });
}
