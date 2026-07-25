import { Link } from 'react-router-dom';
import { MapPin, BedDouble, Bath, Maximize, Heart } from 'lucide-react';
import { cn, formatPrice, getListingTypeLabel, getPropertyTypeLabel } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import type { Property } from '@/types';

interface PropertyCardProps {
  property: Property;
  className?: string;
  onFavorite?: (id: string) => void;
  isFavorited?: boolean;
}

export function PropertyCard({ property, className, onFavorite, isFavorited = false }: PropertyCardProps) {
  const primaryImage = property.images?.find((img) => img.is_primary) || property.images?.[0];
  const cityName = property.city?.name || '';
  const neighborhoodName = property.neighborhood?.name || '';

  return (
    <div className={cn(
      'group bg-white rounded-xl border border-gray-200 overflow-hidden transition-all duration-300',
      'hover:shadow-lg hover:border-gray-300 hover:-translate-y-0.5',
      className
    )}>
      <Link
        to={`/annonces/${property.city?.slug || 'inconnu'}/${property.slug}`}
        className="block"
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
          {primaryImage ? (
            <img
              src={primaryImage.url}
              alt={primaryImage.alt_text || property.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-200">
              <span className="text-gray-400 text-sm">Aucune image</span>
            </div>
          )}

          <div className="absolute top-3 left-3 flex gap-2">
            <Badge variant={property.listing_type === 'rent' ? 'secondary' : 'primary'}>
              {getListingTypeLabel(property.listing_type)}
            </Badge>
            {property.is_featured && (
              <Badge variant="warning">En vedette</Badge>
            )}
          </div>

          {onFavorite && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onFavorite(property.id);
              }}
              className={cn(
                'absolute top-3 right-3 p-2 rounded-full transition-colors',
                isFavorited
                  ? 'bg-danger-500 text-white'
                  : 'bg-white/80 text-gray-600 hover:bg-white hover:text-danger-500'
              )}
              aria-label={isFavorited ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            >
              <Heart className={cn('w-4 h-4', isFavorited && 'fill-current')} />
            </button>
          )}
        </div>
      </Link>

      <div className="p-4">
        <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
          <MapPin className="w-3.5 h-3.5" />
          <span>{neighborhoodName ? `${neighborhoodName}, ` : ''}{cityName}</span>
        </div>

        <Link
          to={`/annonces/${property.city?.slug || 'inconnu'}/${property.slug}`}
          className="block"
        >
          <h3 className="font-semibold text-gray-900 line-clamp-1 group-hover:text-secondary-600 transition-colors">
            {property.title}
          </h3>
        </Link>

        <p className="text-sm text-gray-500 mt-1 line-clamp-2">
          {property.description}
        </p>

        <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
          {property.bedrooms > 0 && (
            <span className="flex items-center gap-1">
              <BedDouble className="w-3.5 h-3.5" />
              {property.bedrooms}
            </span>
          )}
          {property.bathrooms > 0 && (
            <span className="flex items-center gap-1">
              <Bath className="w-3.5 h-3.5" />
              {property.bathrooms}
            </span>
          )}
          {property.building_area && (
            <span className="flex items-center gap-1">
              <Maximize className="w-3.5 h-3.5" />
              {property.building_area} m²
            </span>
          )}
          <Badge variant="default" size="sm">
            {getPropertyTypeLabel(property.property_type)}
          </Badge>
        </div>

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
          <div>
            <span className="text-lg font-bold text-secondary-600">
              {formatPrice(property.price, property.price_currency)}
            </span>
            {property.listing_type === 'rent' && (
              <span className="text-xs text-gray-500">/mois</span>
            )}
          </div>
          {property.price_negotiable && (
            <span className="text-xs text-success-500 font-medium">Négociable</span>
          )}
        </div>
      </div>
    </div>
  );
}
