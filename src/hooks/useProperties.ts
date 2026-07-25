import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { propertiesService } from '@/services/properties.service';
import type { SearchFilters, Property } from '@/types';

export function useProperties(filters: SearchFilters = {}) {
  return useQuery({
    queryKey: ['properties', filters],
    queryFn: () => propertiesService.getAll(filters),
    staleTime: 2 * 60 * 1000,
  });
}

export function useFeaturedProperties(limit: number = 6) {
  return useQuery({
    queryKey: ['properties', 'featured', limit],
    queryFn: () => propertiesService.getFeatured(limit),
    staleTime: 5 * 60 * 1000,
  });
}

export function useRecentProperties(limit: number = 8) {
  return useQuery({
    queryKey: ['properties', 'recent', limit],
    queryFn: () => propertiesService.getRecent(limit),
    staleTime: 2 * 60 * 1000,
  });
}

export function usePropertiesByCity(cityId: string, limit: number = 8) {
  return useQuery({
    queryKey: ['properties', 'city', cityId, limit],
    queryFn: () => propertiesService.getByCity(cityId, limit),
    enabled: !!cityId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useOwnProperties(userId: string | undefined, page: number = 1) {
  return useQuery({
    queryKey: ['properties', 'own', userId, page],
    queryFn: () => propertiesService.getOwnProperties(userId!, page),
    enabled: !!userId,
    staleTime: 30 * 1000,
  });
}

export function useCreateProperty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Property>) => propertiesService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
    },
  });
}

export function useUpdateProperty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Property> }) =>
      propertiesService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
    },
  });
}

export function useDeleteProperty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => propertiesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
    },
  });
}

export function usePropertyAmenities() {
  return useQuery({
    queryKey: ['amenities'],
    queryFn: () => propertiesService.getAmenities(),
    staleTime: 30 * 60 * 1000,
  });
}
