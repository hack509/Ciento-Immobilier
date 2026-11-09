import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/toast-context';
import { useAuth } from '@/contexts/AuthContext';
import { favoritesService } from '@/services/favorites.service';
import { errorMessage } from '@/lib/monetization';
import { cn } from '@/lib/utils';

/** Favourite toggle with optimistic update (rolled back if the server refuses). */
export function FavoriteButton({ propertyId }: { propertyId: string }) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const key = ['favorites', 'check', propertyId];
  const { data: isFavorite = false } = useQuery({
    queryKey: key,
    queryFn: () => favoritesService.check(propertyId),
    enabled: isAuthenticated,
    staleTime: 30_000,
  });

  const toggle = useMutation({
    mutationFn: (next: boolean) => (next ? favoritesService.add(propertyId) : favoritesService.remove(propertyId)),
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<boolean>(key);
      queryClient.setQueryData(key, next);
      return { previous };
    },
    onError: (err, _next, ctx) => {
      queryClient.setQueryData(key, ctx?.previous ?? false);
      toast.error(errorMessage(err, 'Impossible de modifier vos favoris.'));
    },
    onSuccess: (_d, next) => toast.success(next ? 'Ajouté à vos favoris.' : 'Retiré de vos favoris.'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['favorites'] }),
  });

  const onClick = () => {
    if (!isAuthenticated) {
      navigate('/auth/connexion', { state: { from: location.pathname } });
      return;
    }
    if (!toggle.isPending) toggle.mutate(!isFavorite);
  };

  return (
    <Button type="button" variant="ghost" className="w-full" onClick={onClick} aria-pressed={isFavorite}
      icon={<Heart className={cn('h-4 w-4', isFavorite && 'fill-current text-danger-500')} />}>
      {isFavorite ? 'Favori' : 'Favoris'}
    </Button>
  );
}
