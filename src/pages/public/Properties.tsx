import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X, SearchX } from 'lucide-react';
import { PropertyCardSkeleton } from '@/components/ui/Skeleton';
import { PropertyCard } from '@/components/ui/PropertyCard';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { Head } from '@/components/seo/Head';
import { useProperties } from '@/hooks/useProperties';
import { useCities } from '@/hooks/useCities';
import { useDebounce } from '@/hooks';
import { PROPERTY_TYPES, LISTING_TYPES, PRICE_RANGES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { PropertyType, ListingType } from '@/types';

const FILTER_KEYS = ['q', 'property_type', 'listing_type', 'city_id', 'min_price', 'max_price', 'page'] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

const selectClass =
  'select-chevron w-full appearance-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-primary-900 ' +
  'hover:border-gray-300 focus:border-secondary-500 focus:outline-none focus:ring-4 focus:ring-secondary-500/20 transition-colors';

const toNumber = (value: string | null) => (value === null || value === '' ? undefined : Number(value));

export function Properties() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  // Local text state keeps typing smooth; the URL is updated with the debounced value
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const debouncedSearch = useDebounce(search, 400);

  const propertyType = (searchParams.get('property_type') ?? '') as PropertyType | '';
  const listingType = (searchParams.get('listing_type') ?? '') as ListingType | '';
  const cityId = searchParams.get('city_id') ?? '';
  const minPrice = toNumber(searchParams.get('min_price'));
  const maxPrice = toNumber(searchParams.get('max_price'));
  const page = toNumber(searchParams.get('page')) ?? 1;
  const budgetIndex = PRICE_RANGES.findIndex((r) => r.min === minPrice && r.max === maxPrice);

  /** Applies filter changes to the URL; any filter change resets pagination. */
  const updateFilters = (changes: Partial<Record<FilterKey, string | number | undefined>>) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (!('page' in changes)) next.delete('page');
      for (const [key, value] of Object.entries(changes)) {
        if (value === undefined || value === '' || (key === 'page' && value === 1)) next.delete(key);
        else next.set(key, String(value));
      }
      return next;
    }, { replace: true });
  };

  // Push the debounced search text into the URL (resets pagination when it changes)
  useEffect(() => {
    const query = debouncedSearch.trim();
    setSearchParams((prev) => {
      if (query === (prev.get('q') ?? '')) return prev;
      const next = new URLSearchParams(prev);
      next.delete('page');
      if (query) next.set('q', query);
      else next.delete('q');
      return next;
    }, { replace: true });
  }, [debouncedSearch, setSearchParams]);

  const { data: cities } = useCities();
  const { data, isLoading } = useProperties({
    query: searchParams.get('q') || undefined,
    property_type: propertyType || undefined,
    listing_type: listingType || undefined,
    city_id: cityId || undefined,
    min_price: minPrice,
    max_price: maxPrice,
    page,
    per_page: 12,
  });

  const setBudget = (value: string) => {
    const range = value === '' ? undefined : PRICE_RANGES[Number(value)];
    updateFilters({ min_price: range?.min, max_price: range?.max });
  };

  const activeFilterCount = [propertyType, listingType, cityId, minPrice !== undefined].filter(Boolean).length;
  const count = data?.count ?? 0;

  const resetFilters = () => {
    setSearch('');
    setSearchParams({}, { replace: true });
  };

  const filterFields = (
    <>
      <label className="block">
        <select value={propertyType} onChange={(e) => updateFilters({ property_type: e.target.value })} className={selectClass} aria-label="Type de bien">
          <option value="">Tous les types</option>
          {PROPERTY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </label>
      <label className="block">
        <select value={listingType} onChange={(e) => updateFilters({ listing_type: e.target.value })} className={selectClass} aria-label="Type d'annonce">
          <option value="">Vente et location</option>
          {LISTING_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </label>
      <label className="block">
        <select value={cityId} onChange={(e) => updateFilters({ city_id: e.target.value })} className={selectClass} aria-label="Ville">
          <option value="">Toutes les villes</option>
          {(cities || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label className="block">
        <select value={budgetIndex === -1 ? '' : String(budgetIndex)} onChange={(e) => setBudget(e.target.value)} className={selectClass} aria-label="Budget">
          <option value="">Tous les budgets</option>
          {PRICE_RANGES.map((r, i) => <option key={r.label} value={i}>{r.label}</option>)}
        </select>
      </label>
    </>
  );

  return (
    <>
      <Head title="Annonces immobilières" description="Découvrez toutes les annonces immobilières aux Gonaïves et en Haïti. Achetez, louez ou vendez des biens." />
      <div className="bg-gray-50 min-h-screen">
        <div className="bg-primary-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-20">
            <p className="eyebrow !text-secondary-400 mb-2">Annonces</p>
            <h1 className="text-3xl lg:text-4xl font-bold text-white">Trouvez votre prochain bien</h1>
            <p className="mt-2 text-primary-200">Maisons, appartements, terrains et locaux aux Gonaïves et en Haïti.</p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 pb-16">
          {/* Filter bar */}
          <div className="sticky top-[72px] z-30 rounded-2xl bg-white p-3 shadow-card-hover ring-1 ring-gray-100">
            <div className="flex gap-3">
              <div className="relative flex-1 lg:flex-[1.4]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-gray-400" />
                <input
                  type="search"
                  placeholder="Quartier, titre, mot-clé…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Rechercher une annonce"
                  className="w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 py-3 text-sm text-primary-900 placeholder:text-gray-400 focus:border-secondary-500 focus:outline-none focus:ring-4 focus:ring-secondary-500/20"
                />
              </div>
              <div className="hidden lg:grid lg:flex-[3] grid-cols-4 gap-3">{filterFields}</div>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(true)}
                className="lg:hidden relative flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 text-sm font-medium text-primary-900 min-h-[44px]"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filtres
                {activeFilterCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-secondary-500 px-1 text-xs font-bold text-primary-900">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="mt-6 mb-5 flex items-center justify-between gap-4">
            <p className="text-sm text-gray-600" aria-live="polite">
              {isLoading ? 'Recherche en cours…' : (
                <><span className="font-semibold text-primary-900">{count}</span> annonce{count > 1 ? 's' : ''} trouvée{count > 1 ? 's' : ''}</>
              )}
            </p>
            {(activeFilterCount > 0 || searchParams.get('q')) && (
              <button type="button" onClick={resetFilters} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 hover:text-primary-900 min-h-[44px]">
                <X className="h-4 w-4" />
                Effacer les filtres
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => <PropertyCardSkeleton key={i} />)
            ) : data?.data && data.data.length > 0 ? (
              data.data.map((property) => <PropertyCard key={property.id} property={property} />)
            ) : (
              <EmptyState
                icon={<SearchX className="w-7 h-7" />}
                title="Aucune annonce ne correspond"
                description="Élargissez votre recherche en retirant un filtre ou en choisissant une autre ville."
                action={activeFilterCount > 0 || searchParams.get('q') ? <Button variant="outline" onClick={resetFilters}>Effacer les filtres</Button> : undefined}
                className="col-span-full rounded-2xl border border-dashed border-gray-200 bg-white"
              />
            )}
          </div>

          {data && data.total_pages > 1 && (
            <Pagination
              currentPage={data.page}
              totalPages={data.total_pages}
              onPageChange={(p) => { updateFilters({ page: p }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="mt-10"
            />
          )}
        </div>

        {/* Mobile filter sheet */}
        <div className={cn('lg:hidden fixed inset-0 z-50', !mobileFiltersOpen && 'pointer-events-none')} inert={!mobileFiltersOpen}>
          <div
            className={cn('absolute inset-0 bg-primary-900/50 transition-opacity', mobileFiltersOpen ? 'opacity-100' : 'opacity-0')}
            onClick={() => setMobileFiltersOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Filtres"
            className={cn(
              'absolute bottom-0 inset-x-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white transition-transform duration-300 safe-area-bottom',
              mobileFiltersOpen ? 'translate-y-0' : 'translate-y-full'
            )}
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
              <h2 className="text-base font-bold text-primary-900">Filtres</h2>
              <button type="button" onClick={() => setMobileFiltersOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-gray-100" aria-label="Fermer les filtres">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-3 p-5">{filterFields}</div>
            <div className="sticky bottom-0 flex gap-3 border-t border-gray-100 bg-white px-5 py-4">
              <Button variant="outline" className="flex-1" onClick={resetFilters}>Réinitialiser</Button>
              <Button className="flex-1" onClick={() => setMobileFiltersOpen(false)}>
                Voir {isLoading ? '' : count} résultat{count > 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
