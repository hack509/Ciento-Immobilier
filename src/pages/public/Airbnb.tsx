import { useState } from 'react';
import { Search, SlidersHorizontal, Home, CalendarDays, Users, Star } from 'lucide-react';
import { PropertyCardSkeleton } from '@/components/ui/Skeleton';
import { PropertyCard } from '@/components/ui/PropertyCard';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { useProperties } from '@/hooks/useProperties';
import { useCities } from '@/hooks/useCities';
import { useDebounce } from '@/hooks';
import { PROPERTY_TYPES, PRICE_RANGES } from '@/lib/constants';
import type { PropertyType } from '@/types';

export function Airbnb() {
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

  const features = [
    { icon: Home, title: 'Séjours uniques', desc: 'Des logements vérifiés et sécurisés' },
    { icon: CalendarDays, title: 'Réservation flexible', desc: 'Annulation flexible disponible' },
    { icon: Users, title: 'Support 24h/24', desc: 'Une équipe disponible pour vous aider' },
    { icon: Star, title: 'Hôtes certifiés', desc: 'Des hôtes soigneusement sélectionnés' },
  ];

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="bg-gradient-to-r from-rose-500 to-rose-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <Home className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Locations de vacances</h1>
          </div>
          <p className="text-white/80 ml-[52px]">
            Trouvez un séjour idéal parmi des centaines d&apos;annonces vérifiées aux Gonaïves
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {features.map((f) => (
            <div key={f.title} className="bg-white rounded-xl p-4 border border-gray-100 flex items-start gap-3">
              <div className="w-9 h-9 bg-rose-50 rounded-lg flex items-center justify-center shrink-0">
                <f.icon className="w-4 h-4 text-rose-500" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">{f.title}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher un logement..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
              />
            </div>
            <select
              value={propertyType}
              onChange={(e) => { setPropertyType(e.target.value as PropertyType | ''); setPage(1); }}
              className="px-4 py-2.5 rounded-lg border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-rose-500"
            >
              <option value="">Type de logement</option>
              {PROPERTY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <select
              value={cityId}
              onChange={(e) => { setCityId(e.target.value); setPage(1); }}
              className="px-4 py-2.5 rounded-lg border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-rose-500"
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
              className="px-4 py-2.5 rounded-lg border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-rose-500"
            >
              <option value="">Budget / nuit</option>
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
            {isLoading ? 'Chargement...' : `${data?.count || 0} logement${(data?.count || 0) > 1 ? 's' : ''} trouvé${(data?.count || 0) > 1 ? 's' : ''}`}
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
              title="Aucun logement trouvé"
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
