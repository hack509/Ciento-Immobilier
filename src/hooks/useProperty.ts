import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { propertiesService } from '@/services/properties.service';

export function useProperty(slug: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['property', slug],
    queryFn: () => propertiesService.getBySlug(slug),
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
  });

  const incrementViews = useMutation({
    mutationFn: (propertyId: string) => propertiesService.incrementViews(propertyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property', slug] });
    },
  });

  return {
    ...query,
    incrementViews: incrementViews.mutate,
  };
}
