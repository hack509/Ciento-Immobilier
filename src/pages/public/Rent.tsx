import { useState } from 'react';
import { Search, SlidersHorizontal, KeyRound } from 'lucide-react';
import { PropertyCardSkeleton } from '@/components/ui/Skeleton';
import { PropertyCard } from '@/components/ui/PropertyCard';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { useProperties } from '@/hooks/useProperties';
import { useCities } from '@/hooks/useCities';
import { useDebounce } from '@/hooks';
import { PROPERTY_TYPES, PRICE_RANGES } from '@/lib/constants';
import type { PropertyType } from '@/types';

export function Rent() {
  const [search, setSearch] = useState('');
  const [propertyType, setPropertyType] = useState<PropertyType | ''>('');
  const [cityId, setCityId] = useState('');
  const [minPrice, setMinPrice] = useState<number | undefined>(undefined);
  const [maxPrice, setMaxPrice] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounce(search, 400);
  const { data: cities } = useCities();

  const { data, isLoading } = useProperties({
    query: debouncedSearch || undefined,
    property_type: propertyType || undefined,
    listing_type: 'rent',
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

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="bg-gradient-to-r from-secondary-500 to-secondary-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Louer un bien</h1>
          </div>
          <p className="text-white/80 ml-[52px]">
            Trouvez la location idéale parmi des centaines d&apos;annonces vérifiées aux Gonaïves
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-3">
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
              onClick={() => {
                setSearch('');
                setPropertyType('');
                setCityId('');
                setMinPrice(undefined);
                setMaxPrice(undefined);
                setPage(1);
              }}
              className="px-4 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Réinitialiser
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">
            {isLoading ? 'Chargement...' : `${data?.count || 0} location${(data?.count || 0) > 1 ? 's' : ''} trouvée${(data?.count || 0) > 1 ? 's' : ''}`}
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
              title="Aucune location trouvée"
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
  );
}
