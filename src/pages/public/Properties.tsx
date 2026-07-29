import { useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { PropertyCardSkeleton } from '@/components/ui/Skeleton';
import { PropertyCard } from '@/components/ui/PropertyCard';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { Head } from '@/components/seo/Head';
import { useProperties } from '@/hooks/useProperties';
import { useCities } from '@/hooks/useCities';
import { useDebounce } from '@/hooks';
import { PROPERTY_TYPES, LISTING_TYPES, PRICE_RANGES } from '@/lib/constants';
import type { PropertyType, ListingType } from '@/types';

export function Properties() {
  const [search, setSearch] = useState('');
  const [propertyType, setPropertyType] = useState<PropertyType | ''>('');
  const [listingType, setListingType] = useState<ListingType | ''>('');
  const [cityId, setCityId] = useState('');
  const [minPrice, setMinPrice] = useState<number | undefined>(undefined);
  const [maxPrice, setMaxPrice] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const debouncedSearch = useDebounce(search, 400);
  const { data: cities } = useCities();

  const { data, isLoading } = useProperties({
    query: debouncedSearch || undefined,
    property_type: propertyType || undefined,
    listing_type: listingType || undefined,
    city_id: cityId || undefined,
    min_price: minPrice,
    max_price: maxPrice,
    page,
    per_page: 12,
  });

  const handlePriceRange = (range: { min: number; max?: number }) => {
    setMinPrice(range.min);
    setMaxPrice(range.max);
    setPage(1);
  };

  const activeFilterCount = [propertyType, listingType, cityId, minPrice !== undefined].filter(Boolean).length;

  const resetFilters = () => {
    setSearch('');
    setPropertyType('');
    setListingType('');
    setCityId('');
    setMinPrice(undefined);
    setMaxPrice(undefined);
    setPage(1);
  };

  return (
    <>
      <Head title="Annonces immobilières" description="Découvrez toutes les annonces immobilières aux Gonaïves et en Haïti. Achetez, louez ou vendez des biens." />
      <div className="bg-gray-50 min-h-screen">
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Annonces immobilières</h1>
          <p className="text-gray-500">Découvrez les meilleures offres aux Gonaïves</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Desktop Filters */}
        <div className="hidden lg:block bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par titre, description..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500"
              />
            </div>
            <select
              value={propertyType}
              onChange={(e) => { setPropertyType(e.target.value as PropertyType | ''); setPage(1); }}
              className="px-4 py-2.5 rounded-lg border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-secondary-500"
            >
              <option value="">Type de bien</option>
              {PROPERTY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <select
              value={listingType}
              onChange={(e) => { setListingType(e.target.value as ListingType | ''); setPage(1); }}
              className="px-4 py-2.5 rounded-lg border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-secondary-500"
            >
              <option value="">Type d&apos;annonce</option>
              {LISTING_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <select
              value={cityId}
              onChange={(e) => { setCityId(e.target.value); setPage(1); }}
              className="px-4 py-2.5 rounded-lg border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-secondary-500"
            >
              <option value="">Ville</option>
              {(cities || []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              onChange={(e) => {
                const range = PRICE_RANGES[Number(e.target.value)];
                if (range) handlePriceRange(range);
                else { setMinPrice(undefined); setMaxPrice(undefined); setPage(1); }
              }}
              className="px-4 py-2.5 rounded-lg border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-secondary-500"
            >
              <option value="">Budget</option>
              {PRICE_RANGES.map((r, i) => (
                <option key={i} value={i}>{r.label}</option>
              ))}
            </select>
            <button
              onClick={resetFilters}
              className="px-4 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Réinitialiser
            </button>
          </div>
        </div>

        {/* Mobile Search + Filter Button */}
        <div className="lg:hidden mb-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setMobileFiltersOpen(true)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filtres
              {activeFilterCount > 0 && (
                <span className="w-5 h-5 bg-secondary-500 text-white text-xs rounded-full flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
            {activeFilterCount > 0 && (
              <button
                onClick={resetFilters}
                className="px-4 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-600 bg-white hover:bg-gray-50"
              >
                Tout effacer
              </button>
            )}
          </div>
        </div>

        {/* Mobile Filter Panel */}
        {mobileFiltersOpen && (
          <div className="lg:hidden fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileFiltersOpen(false)} />
            <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[85vh] overflow-y-auto">
              <div className="sticky top-0 bg-white px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Filtres</h3>
                <button onClick={() => setMobileFiltersOpen(false)} className="p-1 rounded-lg hover:bg-gray-100">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Type de bien</label>
                  <select
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value as PropertyType | '')}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-secondary-500"
                  >
                    <option value="">Tous les types</option>
                    {PROPERTY_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Type d&apos;annonce</label>
                  <select
                    value={listingType}
                    onChange={(e) => setListingType(e.target.value as ListingType | '')}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-secondary-500"
                  >
                    <option value="">Toutes les annonces</option>
                    {LISTING_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Ville</label>
                  <select
                    value={cityId}
                    onChange={(e) => setCityId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-secondary-500"
                  >
                    <option value="">Toutes les villes</option>
                    {(cities || []).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Budget</label>
                  <select
                    onChange={(e) => {
                      const range = PRICE_RANGES[Number(e.target.value)];
                      if (range) handlePriceRange(range);
                      else { setMinPrice(undefined); setMaxPrice(undefined); }
                    }}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-secondary-500"
                  >
                    <option value="">Tous les budgets</option>
                    {PRICE_RANGES.map((r, i) => (
                      <option key={i} value={i}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="sticky bottom-0 bg-white px-4 py-3 border-t border-gray-100 flex gap-3">
                <button
                  onClick={resetFilters}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Réinitialiser
                </button>
                <button
                  onClick={() => { setPage(1); setMobileFiltersOpen(false); }}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-secondary-500 text-white text-sm font-semibold hover:bg-secondary-600"
                >
                  Voir les résultats
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">
            {isLoading ? 'Chargement...' : `${data?.count || 0} annonce${(data?.count || 0) > 1 ? 's' : ''} trouvée${(data?.count || 0) > 1 ? 's' : ''}`}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <PropertyCardSkeleton key={i} />
            ))
          ) : data?.data && data.data.length > 0 ? (
            data.data.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))
          ) : (
            <EmptyState
              title="Aucune annonce trouvée"
              description="Essayez de modifier vos filtres de recherche."
              className="col-span-full"
            />
          )}
        </div>

        {data && data.total_pages > 1 && (
          <Pagination
            currentPage={data.page}
            totalPages={data.total_pages}
            onPageChange={setPage}
            className="mt-8"
          />
        )}
      </div>
    </div>
    </>
  );
}
