import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Building2, Eye, MessageSquare } from 'lucide-react';
import { PageHeader, Panel, FilterTabs } from '@/components/dashboard/DashboardUI';
import { StatusBadge } from '@/components/billing/BillingUI';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { PremiumBadge, SponsoredBadge } from '@/components/ui/PromoBadges';
import { useAgencyPortfolio, useMyAgencies, useQuota } from '@/hooks/useMarketplace';
import { canPublishMore, isPremium, isSponsored } from '@/lib/monetization';
import { formatPrice, getStatusLabel } from '@/lib/utils';

const STATUS_FILTERS = [
  { value: '', label: 'Toutes' },
  { value: 'active', label: 'En ligne' },
  { value: 'pending', label: 'En attente' },
  { value: 'sold', label: 'Vendues' },
  { value: 'rented', label: 'Louées' },
  { value: 'suspended', label: 'Refusées' },
];

export function AgencyPortfolio() {
  const { data: agencies, isLoading: loadingAgency } = useMyAgencies();
  const membership = agencies?.[0];
  const [status, setStatus] = useState('');
  const { data: properties, isLoading } = useAgencyPortfolio(membership?.agency.id, status || undefined);
  const { data: quota } = useQuota(membership?.agency.id ?? null);

  if (loadingAgency) return <LoadingSpinner className="py-24" />;
  if (!membership) {
    return <EmptyState icon={<Building2 className="h-7 w-7" />} title="Aucune agence" description="Créez votre agence pour gérer un portefeuille."
      action={<Link to="/dashboard/agence"><Button>Créer mon agence</Button></Link>} />;
  }

  const canAdd = membership.canPublish && canPublishMore(quota?.used ?? 0, quota?.limit);

  return (
    <div>
      <PageHeader
        title="Portefeuille immobilier"
        subtitle={`${quota?.used ?? 0} annonce(s) active(s) ou en attente · limite ${quota?.limit ?? 'illimitée'}`}
        actions={membership.canPublish ? (
          canAdd ? (
            <Link to={`/dashboard/annonces/nouvelle?agence=${membership.agency.id}`}><Button icon={<Plus className="h-4 w-4" />}>Nouvelle annonce agence</Button></Link>
          ) : (
            <Link to="/dashboard/abonnement?espace=agence"><Button variant="secondary">Limite atteinte — changer de formule</Button></Link>
          )
        ) : null}
      />
      <div className="mb-4">
        <FilterTabs label="Filtrer par statut" value={status} onChange={setStatus} options={STATUS_FILTERS} />
      </div>
      <Panel>
        {isLoading ? <LoadingSpinner className="py-16" /> : !properties || properties.length === 0 ? (
          <EmptyState icon={<Building2 className="h-7 w-7" />} title="Aucune annonce" description="Les annonces publiées pour l’agence apparaîtront ici." />
        ) : (
          <ul className="divide-y divide-gray-100">
            {properties.map((p) => {
              const image = p.images?.find((i) => i.is_primary) || p.images?.[0];
              return (
                <li key={p.id} className="flex items-center gap-4 p-4">
                  <div className="h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-primary-50">
                    {image && <img src={image.url} alt="" className="h-full w-full object-cover" loading="lazy" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-primary-900">{p.title}</p>
                    <p className="text-sm text-gray-500">{formatPrice(p.price, p.price_currency)} · {p.city?.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <StatusBadge status={p.status} label={getStatusLabel(p.status)} />
                      {isSponsored(p) && <SponsoredBadge />}
                      {isPremium(p) && <PremiumBadge />}
                      <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{p.views_count}</span>
                      <span className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" />{p.inquiries_count}</span>
                    </div>
                  </div>
                  {membership.canPublish && (
                    <Link to={`/dashboard/annonces/${p.id}/modifier`}><Button size="sm" variant="outline" icon={<Pencil className="h-4 w-4" />}>Modifier</Button></Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
