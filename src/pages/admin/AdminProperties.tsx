import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, X, RotateCcw, Star, ExternalLink, Search, ImageOff, Mail, Phone, ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader, FilterTabs } from '@/components/dashboard/DashboardUI';
import { useDebounce } from '@/hooks';
import { useAdminStats, useModerateProperty, useModerationQueue, useSetFeatured } from '@/hooks/useAdmin';
import {
  cn, formatPrice, formatRelativeTime, getListingTypeLabel, getPropertyTypeLabel, getStatusColor, getStatusLabel,
} from '@/lib/utils';
import type { Property, PropertyStatus } from '@/types';

const STATUS_TABS: { value: PropertyStatus | ''; label: string }[] = [
  { value: 'pending', label: 'En attente' },
  { value: 'active', label: 'En ligne' },
  { value: 'suspended', label: 'Refusées' },
  { value: '', label: 'Toutes' },
];

function ModerationCard({ property, onReject }: { property: Property; onReject: (property: Property) => void }) {
  const moderate = useModerateProperty();
  const setFeatured = useSetFeatured();
  const image = property.images?.find((img) => img.is_primary) || property.images?.[0];
  const busy = moderate.isPending || setFeatured.isPending;
  const publicUrl = `/annonces/${property.city?.slug || 'inconnu'}/${property.slug}`;

  return (
    <li className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card">
      <div className="flex flex-col sm:flex-row">
        <div className="relative aspect-[16/9] shrink-0 bg-primary-50 sm:aspect-auto sm:w-56">
          {image ? (
            <img src={image.url} alt={image.alt_text || property.title} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-1 text-primary-300 sm:min-h-32">
              <ImageOff className="h-6 w-6" />
              <span className="text-xs">Aucune photo</span>
            </div>
          )}
          <span className="absolute left-2 top-2 rounded-md bg-white/95 px-2 py-0.5 text-[11px] font-bold text-primary-900">
            {property.images?.length ?? 0} photo{(property.images?.length ?? 0) > 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-primary-900">{property.title}</h3>
              <p className="mt-0.5 text-sm text-gray-500">
                {getPropertyTypeLabel(property.property_type)} · {getListingTypeLabel(property.listing_type)}
                {property.city?.name ? ` · ${property.city.name}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {property.is_featured && <Badge variant="secondary">En vedette</Badge>}
              <Badge variant={getStatusColor(property.status)}>{getStatusLabel(property.status)}</Badge>
            </div>
          </div>

          <p className="mt-2 font-display text-lg font-bold text-primary-900">
            {formatPrice(property.price, property.price_currency)}
            {property.listing_type === 'rent' && <span className="text-sm font-medium text-gray-500"> / mois</span>}
          </p>
          {property.description && <p className="mt-2 line-clamp-2 text-sm text-gray-600">{property.description}</p>}

          {property.owner && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
              <span className="font-semibold text-primary-800">{property.owner.first_name} {property.owner.last_name}</span>
              {property.owner.email && (
                <a href={`mailto:${property.owner.email}`} className="inline-flex items-center gap-1 hover:text-primary-900">
                  <Mail className="h-3.5 w-3.5" />{property.owner.email}
                </a>
              )}
              {property.owner.phone && (
                <a href={`tel:${property.owner.phone}`} className="inline-flex items-center gap-1 hover:text-primary-900">
                  <Phone className="h-3.5 w-3.5" />{property.owner.phone}
                </a>
              )}
              <span>Soumise {formatRelativeTime(property.created_at)}</span>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
            {property.status !== 'active' && (
              <Button
                size="sm"
                disabled={busy}
                onClick={() => moderate.mutate({ id: property.id, decision: 'approve' })}
                icon={<Check className="h-4 w-4" />}
              >
                Approuver
              </Button>
            )}
            {property.status !== 'suspended' && (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => onReject(property)} icon={<X className="h-4 w-4" />}>
                Refuser
              </Button>
            )}
            {property.status !== 'pending' && (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => moderate.mutate({ id: property.id, decision: 'review' })}
                icon={<RotateCcw className="h-4 w-4" />}
              >
                Remettre en attente
              </Button>
            )}
            {property.status === 'active' && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  aria-pressed={property.is_featured}
                  onClick={() => setFeatured.mutate({ id: property.id, isFeatured: !property.is_featured })}
                  icon={<Star className={cn('h-4 w-4', property.is_featured && 'fill-secondary-500 text-secondary-600')} />}
                >
                  {property.is_featured ? 'Retirer de la vedette' : 'Mettre en vedette'}
                </Button>
                <Link to={publicUrl} target="_blank" rel="noopener">
                  <Button size="sm" variant="ghost" icon={<ExternalLink className="h-4 w-4" />}>Voir</Button>
                </Link>
              </>
            )}
          </div>
          {(moderate.isError || setFeatured.isError) && (
            <p role="alert" className="mt-2 text-xs text-danger-600">L’action a échoué. Veuillez réessayer.</p>
          )}
        </div>
      </div>
    </li>
  );
}

export function AdminProperties() {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = (searchParams.get('status') ?? 'pending') as PropertyStatus | '';
  const page = Number(searchParams.get('page')) || 1;
  const [search, setSearch] = useState('');
  const query = useDebounce(search.trim(), 350);
  const [rejecting, setRejecting] = useState<Property | null>(null);
  const moderate = useModerateProperty();
  const { data: stats } = useAdminStats();
  const { data, isLoading, isFetching } = useModerationQueue({ status, query, page });

  // No `status` param means "pending" (the default queue); `status=` means all listings
  const setParam = (key: 'status' | 'page', value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (key === 'status') {
        next.delete('page');
        if (value === 'pending') next.delete('status');
        else next.set('status', value);
      } else if (value === '1') {
        next.delete('page');
      } else {
        next.set('page', value);
      }
      return next;
    }, { replace: true });
  };

  // New search text restarts at page 1 (skipped on mount so deep links keep their page)
  const previousQuery = useRef(query);
  useEffect(() => {
    if (previousQuery.current === query) return;
    previousQuery.current = query;
    setSearchParams((prev) => {
      if (!prev.has('page')) return prev;
      const next = new URLSearchParams(prev);
      next.delete('page');
      return next;
    }, { replace: true });
  }, [query, setSearchParams]);

  const confirmReject = () => {
    if (!rejecting) return;
    moderate.mutate({ id: rejecting.id, decision: 'reject' }, { onSuccess: () => setRejecting(null) });
  };

  return (
    <div>
      <PageHeader
        title="Modération des annonces"
        subtitle="Les annonces des propriétaires restent invisibles tant qu’elles ne sont pas approuvées."
      />

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterTabs
          label="Statut des annonces"
          value={status}
          onChange={(value) => setParam('status', value)}
          options={STATUS_TABS.map((tab) => ({
            ...tab,
            count: tab.value === 'pending' ? stats?.pendingListings : tab.value === 'active' ? stats?.activeListings : undefined,
          }))}
        />
        <div className="relative lg:w-72">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un titre…"
            aria-label="Rechercher une annonce par titre"
            className="w-full rounded-xl border border-primary-200 bg-white py-2.5 pl-10 pr-4 text-sm text-primary-900 focus:border-secondary-500 focus:outline-none focus:ring-4 focus:ring-secondary-500/25"
          />
        </div>
      </div>

      <p className="mb-4 text-sm text-gray-500" aria-live="polite">
        {isLoading ? 'Chargement…' : `${data?.count ?? 0} annonce${(data?.count ?? 0) > 1 ? 's' : ''}`}
        {isFetching && !isLoading ? ' · mise à jour…' : ''}
      </p>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-44 animate-pulse rounded-2xl bg-white" />)}
        </div>
      ) : data && data.data.length > 0 ? (
        <ul className="space-y-4">
          {data.data.map((property) => (
            <ModerationCard key={property.id} property={property} onReject={setRejecting} />
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<ClipboardCheck className="h-7 w-7" />}
          title={status === 'pending' ? 'Aucune annonce en attente' : 'Aucune annonce'}
          description={status === 'pending' ? 'Toutes les annonces soumises ont été traitées.' : 'Aucune annonce ne correspond à ce filtre.'}
          className="rounded-2xl border border-dashed border-gray-200 bg-white"
        />
      )}

      {data && data.total_pages > 1 && (
        <Pagination
          currentPage={data.page}
          totalPages={data.total_pages}
          onPageChange={(p) => setParam('page', String(p))}
          className="mt-8"
        />
      )}

      <Modal isOpen={!!rejecting} onClose={() => setRejecting(null)} title="Refuser cette annonce ?">
        <p className="text-sm text-gray-600">
          « {rejecting?.title} » sera retirée du site et son propriétaire recevra une notification.
          Vous pourrez la remettre en attente plus tard.
        </p>
        {moderate.isError && <p role="alert" className="mt-3 text-sm text-danger-600">Le refus a échoué. Veuillez réessayer.</p>}
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setRejecting(null)}>Annuler</Button>
          <Button variant="danger" isLoading={moderate.isPending} onClick={confirmReject} icon={<X className="h-4 w-4" />}>
            Refuser l’annonce
          </Button>
        </div>
      </Modal>
    </div>
  );
}
