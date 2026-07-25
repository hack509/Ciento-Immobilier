import { Heart } from 'lucide-react';
import { PropertyCard } from '@/components/ui/PropertyCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useFavorites, useToggleFavorite } from '@/hooks/useFavorites';

export function Favorites() {
  const { data: favorites, isLoading } = useFavorites();
  const toggleFavorite = useToggleFavorite();

  const handleFavorite = (propertyId: string) => {
    toggleFavorite.mutate(propertyId);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Mes favoris</h1>
      <p className="text-gray-500 text-sm mb-6">Retrouvez tous les biens que vous avez sauvegardés</p>

      {isLoading ? (
        <LoadingSpinner size="lg" text="Chargement..." className="py-20" />
      ) : favorites && favorites.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {favorites.map((fav) => {
            const property = fav.property;
            if (!property) return null;
            return (
              <PropertyCard
                key={fav.id}
                property={property}
                isFavorited
                onFavorite={handleFavorite}
              />
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Heart className="w-8 h-8" />}
          title="Aucun favori"
          description="Parcourez les annonces et ajoutez vos biens préférés ici."
        />
      )}
    </div>
  );
}
