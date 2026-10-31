import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Home as HomeIcon, Wallet, ChevronDown } from 'lucide-react';
import { useCities } from '@/hooks/useCities';
import { PROPERTY_TYPES, PRICE_RANGES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { ListingType } from '@/types';

const TABS: { value: ListingType | ''; label: string }[] = [
  { value: 'sale', label: 'Acheter' },
  { value: 'rent', label: 'Louer' },
  { value: '', label: 'Tout' },
];

interface FieldProps {
  icon: typeof MapPin;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}

function SearchField({ icon: Icon, label, value, onChange, children }: FieldProps) {
  return (
    <label className="relative flex-1 min-w-0 group">
      <span className="absolute left-12 top-2 text-[10px] font-semibold uppercase tracking-wider text-primary-500 pointer-events-none">
        {label}
      </span>
      <span className="absolute left-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-lg bg-secondary-500 text-primary-900 pointer-events-none">
        <Icon className="h-4 w-4" />
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none bg-primary-50 hover:bg-primary-100 rounded-xl pl-12 pr-9 pt-6 pb-2 text-sm font-semibold text-primary-900 border border-primary-200 group-hover:border-primary-300 focus:bg-white focus:border-secondary-500 focus:outline-none focus:ring-4 focus:ring-secondary-500/25 transition-colors cursor-pointer min-h-[52px]"
      >
        {children}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-500 pointer-events-none" />
    </label>
  );
}

/** Hero search: listing tabs + city / type / budget, forwarded to /annonces as URL filters. */
export function HeroSearch() {
  const navigate = useNavigate();
  const { data: cities } = useCities();
  const [listingType, setListingType] = useState<ListingType | ''>('sale');
  const [cityId, setCityId] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [budget, setBudget] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (listingType) params.set('listing_type', listingType);
    if (cityId) params.set('city_id', cityId);
    if (propertyType) params.set('property_type', propertyType);
    const range = budget !== '' ? PRICE_RANGES[Number(budget)] : undefined;
    if (range) {
      params.set('min_price', String(range.min));
      if (range.max !== undefined) params.set('max_price', String(range.max));
    }
    navigate(`/annonces${params.size ? `?${params}` : ''}`);
  };

  return (
    <div className="w-full max-w-3xl">
      <div role="group" aria-label="Type de recherche" className="flex gap-1">
        {TABS.map((tab) => {
          const selected = listingType === tab.value;
          return (
            <button
              key={tab.label}
              type="button"
              aria-pressed={selected}
              onClick={() => setListingType(tab.value)}
              className={cn(
                'px-5 py-2.5 rounded-t-xl text-sm font-semibold transition-colors min-h-[44px]',
                selected
                  ? 'bg-white text-primary-900'
                  : 'bg-primary-800/80 text-white hover:bg-primary-700 ring-1 ring-inset ring-white/15'
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl rounded-tl-none p-2.5 shadow-float flex flex-col md:flex-row gap-2"
      >
        <SearchField icon={MapPin} label="Ville" value={cityId} onChange={setCityId}>
          <option value="">Toutes</option>
          {(cities || []).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </SearchField>
        <SearchField icon={HomeIcon} label="Type de bien" value={propertyType} onChange={setPropertyType}>
          <option value="">Tous les types</option>
          {PROPERTY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </SearchField>
        <SearchField icon={Wallet} label="Budget" value={budget} onChange={setBudget}>
          <option value="">Tous budgets</option>
          {PRICE_RANGES.map((r, i) => (
            <option key={r.label} value={i}>{r.label}</option>
          ))}
        </SearchField>
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-secondary-500 text-primary-900 font-semibold text-sm hover:bg-secondary-400 active:bg-secondary-600 transition-colors shadow-sm min-h-[48px] shrink-0"
        >
          <Search className="w-4 h-4" />
          Rechercher
        </button>
      </form>
    </div>
  );
}
