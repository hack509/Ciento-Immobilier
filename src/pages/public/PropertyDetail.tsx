import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapPin, BedDouble, Bath, Maximize, Building, Calendar, Eye, Heart, Share2, Phone, Mail, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useProperty } from '@/hooks/useProperty';
import { formatPrice, formatDate, getListingTypeLabel, getPropertyTypeLabel } from '@/lib/utils';

export function PropertyDetail() {
  const { propertySlug } = useParams<{ propertySlug: string }>();
  const { data: property, isLoading, error, incrementViews } = useProperty(propertySlug || '');

  useEffect(() => {
    if (property?.id) {
      incrementViews(property.id);
    }
  }, [property?.id, incrementViews]);

  if (isLoading) {
    return (
      <div className="bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingSpinner size="lg" text="Chargement de l'annonce..." className="py-32" />
        </div>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Annonce introuvable</h1>
          <p className="text-gray-500 mb-6">Cette annonce n&apos;existe pas ou a été supprimée.</p>
          <Link to="/annonces">
            <Button>Retour aux annonces</Button>
          </Link>
        </div>
      </div>
    );
  }

  const primaryImage = property.images?.find((img) => img.is_primary) || property.images?.[0];
  const otherImages = property.images?.filter((img) => img !== primaryImage) || [];

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link to="/" className="hover:text-secondary-600">Accueil</Link>
          <ChevronRight className="w-4 h-4" />
          <Link to="/annonces" className="hover:text-secondary-600">Annonces</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-gray-900">{property.title}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Gallery */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {primaryImage ? (
                <div className="aspect-[16/9] relative">
                  <img
                    src={primaryImage.url}
                    alt={primaryImage.alt_text || property.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-4 left-4 flex gap-2">
                    <Badge variant={property.listing_type === 'rent' ? 'secondary' : 'primary'}>
                      {getListingTypeLabel(property.listing_type)}
                    </Badge>
                    {property.is_featured && (
                      <Badge variant="warning">En vedette</Badge>
                    )}
                  </div>
                </div>
              ) : (
                <div className="aspect-[16/9] bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-400">Aucune image</span>
                </div>
              )}

              {otherImages.length > 0 && (
                <div className="grid grid-cols-4 gap-2 p-2">
                  {otherImages.slice(0, 4).map((img) => (
                    <div key={img.id} className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                      <img src={img.url} alt={img.alt_text || ''} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 lg:p-8">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                <MapPin className="w-4 h-4" />
                <span>{property.neighborhood?.name ? `${property.neighborhood.name}, ` : ''}{property.city?.name}</span>
              </div>

              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-4">{property.title}</h1>

              <div className="text-3xl font-bold text-primary-700 mb-6">
                {formatPrice(property.price, property.price_currency)}
                {property.listing_type === 'rent' && <span className="text-base font-normal text-gray-500">/mois</span>}
                {property.price_negotiable && (
                  <span className="ml-3 text-sm font-normal text-success-500">Négociable</span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                {property.bedrooms > 0 && (
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <BedDouble className="w-6 h-6 text-secondary-600 mx-auto mb-1" />
                    <span className="text-sm font-medium">{property.bedrooms} Chambres</span>
                  </div>
                )}
                {property.bathrooms > 0 && (
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <Bath className="w-6 h-6 text-secondary-600 mx-auto mb-1" />
                    <span className="text-sm font-medium">{property.bathrooms} SDB</span>
                  </div>
                )}
                {property.building_area && (
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <Maximize className="w-6 h-6 text-secondary-600 mx-auto mb-1" />
                    <span className="text-sm font-medium">{property.building_area} m²</span>
                  </div>
                )}
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <Building className="w-6 h-6 text-secondary-600 mx-auto mb-1" />
                  <span className="text-sm font-medium">{property.floors} {property.floors > 1 ? 'Étages' : 'Étage'}</span>
                </div>
              </div>

              <h2 className="text-lg font-semibold text-gray-900 mb-3">Description</h2>
              <p className="text-gray-600 leading-relaxed whitespace-pre-line">{property.description}</p>

              <div className="flex items-center gap-4 mt-6 pt-4 border-t border-gray-100 text-sm text-gray-500">
                <span className="flex items-center gap-1"><Eye className="w-4 h-4" /> {property.views_count} vues</span>
                <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> Publiée le {formatDate(property.created_at)}</span>
              </div>
            </div>

            {/* Amenities */}
            {property.amenities && property.amenities.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 lg:p-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Équipements</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {property.amenities.map((pa, i) => {
                    const amenity = 'amenity' in pa ? (pa as { amenity: { id: string; name: string } }).amenity : null;
                    return amenity ? (
                      <div key={amenity.id || i} className="flex items-center gap-2 text-sm text-gray-600">
                        <div className="w-2 h-2 bg-success-500 rounded-full" />
                        {amenity.name}
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Contact Card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 sticky top-24">
              <h3 className="font-semibold text-gray-900 mb-4">Contacter</h3>

              {property.agency ? (
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100">
                  {property.agency.logo_url ? (
                    <img src={property.agency.logo_url} alt={property.agency.name} className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 bg-secondary-100 rounded-full flex items-center justify-center text-secondary-700 font-medium">
                      {property.agency.name[0]}
                    </div>
                  )}
                  <div>
                    <div className="font-medium text-gray-900">{property.agency.name}</div>
                    <div className="text-xs text-gray-500">Agence immobilière</div>
                  </div>
                </div>
              ) : property.owner ? (
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100">
                  {property.owner.avatar_url ? (
                    <img src={property.owner.avatar_url} alt={property.owner.first_name} className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 bg-secondary-100 rounded-full flex items-center justify-center text-secondary-700 font-medium">
                      {property.owner.first_name[0]}{property.owner.last_name[0]}
                    </div>
                  )}
                  <div>
                    <div className="font-medium text-gray-900">{property.owner.first_name} {property.owner.last_name}</div>
                    <div className="text-xs text-gray-500">Propriétaire</div>
                  </div>
                </div>
              ) : null}

              <div className="space-y-3">
                <Button className="w-full" icon={<Phone className="w-4 h-4" />}>
                  Appeler
                </Button>
                <Button variant="outline" className="w-full" icon={<Mail className="w-4 h-4" />}>
                  Envoyer un message
                </Button>
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="ghost" className="w-full" icon={<Heart className="w-4 h-4" />}>
                    Favoris
                  </Button>
                  <Button variant="ghost" className="w-full" icon={<Share2 className="w-4 h-4" />}>
                    Partager
                  </Button>
                </div>
              </div>
            </div>

            {/* Category Info */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-3">Détails</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Type</span>
                  <span className="font-medium">{getPropertyTypeLabel(property.property_type)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Catégorie</span>
                  <span className="font-medium">{property.category?.name}</span>
                </div>
                {property.year_built && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Année</span>
                    <span className="font-medium">{property.year_built}</span>
                  </div>
                )}
                {property.land_area && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Terrain</span>
                    <span className="font-medium">{property.land_area} m²</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
