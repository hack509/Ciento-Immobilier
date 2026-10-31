import { Link } from 'react-router-dom';
import { MapPin, BedDouble, Bath, Maximize, Heart, ImageOff } from 'lucide-react';
import { cn, formatPrice, getListingTypeLabel, getPropertyTypeLabel } from '@/lib/utils';
import type { Property } from '@/types';

interface PropertyCardProps {
  property: Property;
  className?: string;
  onFavorite?: (id: string) => void;
  isFavorited?: boolean;
}

export function PropertyCard({ property, className, onFavorite, isFavorited = false }: PropertyCardProps) {
  const primaryImage = property.images?.find((img) => img.is_primary) || property.images?.[0];
  const location = [property.neighborhood?.name, property.city?.name].filter(Boolean).join(', ');
  const href = `/annonces/${property.city?.slug || 'inconnu'}/${property.slug}`;
  const isRent = property.listing_type === 'rent';
  const area = property.building_area || property.land_area;

  return (
    <article className={cn(
      'group relative flex flex-col bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-card',
      'transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1',
      className
    )}>
      <div className="relative aspect-[4/3] overflow-hidden bg-primary-50">
        {primaryImage ? (
          <img
            src={primaryImage.url}
            alt={primaryImage.alt_text || property.title}
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-primary-300">
            <ImageOff className="h-8 w-8" />
            <span className="text-xs font-medium">Photo à venir</span>
          </div>
        )}
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-primary-900/80 to-transparent" />

        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          <span className={cn(
            'rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wide',
            isRent ? 'bg-primary-800 text-white' : 'bg-secondary-500 text-primary-900'
          )}>
            {getListingTypeLabel(property.listing_type)}
          </span>
          {property.is_featured && (
            <span className="rounded-md bg-white/95 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-primary-900">
              En vedette
            </span>
          )}
        </div>

        <p className="absolute bottom-3 left-4 right-4 text-white">
          <span className="font-display text-xl font-bold">
            {formatPrice(property.price, property.price_currency)}
          </span>
          {isRent && <span className="text-sm font-medium text-white/80"> / mois</span>}
        </p>
      </div>

      {onFavorite && (
        <button
          type="button"
          onClick={() => onFavorite(property.id)}
          className={cn(
            'absolute top-3 right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full backdrop-blur transition-colors',
            isFavorited ? 'bg-danger-500 text-white' : 'bg-white/85 text-primary-900 hover:bg-white hover:text-danger-500'
          )}
          aria-label={isFavorited ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          aria-pressed={isFavorited}
        >
          <Heart className={cn('h-4.5 w-4.5', isFavorited && 'fill-current')} />
        </button>
      )}

      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-semibold text-primary-900 line-clamp-1">
          {/* Stretched link: the whole card is clickable, favorite button stays independent */}
          <Link to={href} className="after:absolute after:inset-0 focus:outline-none focus-visible:after:ring-2 focus-visible:after:ring-secondary-500 focus-visible:after:rounded-2xl">
            {property.title}
          </Link>
        </h3>
        {location && (
          <p className="mt-1 flex items-center gap-1 text-sm text-gray-500">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{location}</span>
          </p>
        )}

        <div className="mt-auto pt-4">
          <div className="flex items-center gap-4 border-t border-gray-100 pt-4 text-sm text-gray-600">
            {property.bedrooms > 0 && (
              <span className="flex items-center gap-1.5" title="Chambres">
                <BedDouble className="h-4 w-4 text-primary-400" />
                {property.bedrooms}<span className="sr-only"> chambres</span>
              </span>
            )}
            {property.bathrooms > 0 && (
              <span className="flex items-center gap-1.5" title="Salles de bain">
                <Bath className="h-4 w-4 text-primary-400" />
                {property.bathrooms}<span className="sr-only"> salles de bain</span>
              </span>
            )}
            {area ? (
              <span className="flex items-center gap-1.5" title="Surface">
                <Maximize className="h-4 w-4 text-primary-400" />
                {area} m²
              </span>
            ) : null}
            <span className="ml-auto rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-700">
              {getPropertyTypeLabel(property.property_type)}
            </span>
          </div>
          {property.price_negotiable && (
            <p className="mt-2 text-xs font-medium text-success-700">Prix négociable</p>
          )}
        </div>
      </div>
    </article>
  );
}
