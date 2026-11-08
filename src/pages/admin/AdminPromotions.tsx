import { useState } from 'react';
import { Ban } from 'lucide-react';
import { PageHeader, Panel, FilterTabs } from '@/components/dashboard/DashboardUI';
import { DataTable, StatusBadge } from '@/components/billing/BillingUI';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useAdminMutation, useAdminQuery } from '@/hooks/useAdminMarketplace';
import { adminMarketplaceService } from '@/services/admin-marketplace.service';
import { PROMOTION_STATUS_LABELS, errorMessage } from '@/lib/monetization';
import { formatDate } from '@/lib/utils';
import type { ListingPromotion, PromotionOffer, PromotionStatus } from '@/types/marketplace';

function OfferRow({ offer }: { offer: PromotionOffer }) {
  const [price, setPrice] = useState(String(offer.price));
  const save = useAdminMutation((changes: Partial<PromotionOffer>) => adminMarketplaceService.saveOffer({ id: offer.id, ...changes }));
  const dirty = Number(price) !== Number(offer.price);
  return (
    <tr>
      <td className="px-5 py-3 font-medium">{offer.kind === 'sponsored' ? 'Sponsorisé' : 'Premium'}</td>
      <td className="px-5 py-3">{offer.duration_days} jours</td>
      <td className="px-5 py-3">
        <div className="flex items-center gap-2">
          <input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} aria-label="Prix"
            className="w-32 rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
          <span className="text-xs text-gray-500">{offer.currency}</span>
          {dirty && <Button size="sm" isLoading={save.isPending} onClick={() => save.mutate({ price: Number(price) })}>Enregistrer</Button>}
        </div>
        {save.isError && <p className="mt-1 text-xs text-danger-600">{errorMessage(save.error)}</p>}
      </td>
      <td className="px-5 py-3">
        <Switch label={offer.is_active ? 'Active' : 'Inactive'} checked={offer.is_active}
          disabled={!offer.is_active && Number(offer.price) <= 0}
          onChange={(v) => save.mutate({ is_active: v })} />
      </td>
    </tr>
  );
}

export function AdminPromotions() {
  const [status, setStatus] = useState<PromotionStatus | ''>('active');
  const offers = useAdminQuery(['offers'], () => adminMarketplaceService.getAllOffers());
  const promotions = useAdminQuery(['promotions', status], () => adminMarketplaceService.getPromotions(status));
  const cancel = useAdminMutation((v: { id: string; reason: string }) => adminMarketplaceService.cancelPromotion(v.id, v.reason));
  const [target, setTarget] = useState<ListingPromotion | null>(null);

  return (
    <div>
      <PageHeader title="Promotions" subtitle="Tarifs des annonces sponsorisées et Premium, suivi des promotions en cours." />
      <Panel title="Tarifs (une offre ne peut être activée qu’avec un prix > 0)">
        {offers.isLoading ? <LoadingSpinner className="py-12" /> : (
          <DataTable headers={['Type', 'Durée', 'Prix', 'État']}>
            {(offers.data || []).map((o) => <OfferRow key={`${o.id}-${o.updated_at}`} offer={o} />)}
          </DataTable>
        )}
      </Panel>

      <Panel title="Promotions" className="mt-6" action={
        <FilterTabs label="Statut" value={status} onChange={setStatus} options={[
          { value: 'active', label: 'En cours' }, { value: 'scheduled', label: 'Programmées' },
          { value: 'expired', label: 'Terminées' }, { value: 'cancelled', label: 'Annulées' }, { value: '', label: 'Toutes' },
        ]} />
      }>
        {promotions.isLoading ? <LoadingSpinner className="py-12" /> : (
          <DataTable headers={['Annonce', 'Type', 'Début', 'Fin', 'Statut', '']}
            empty={(promotions.data || []).length === 0 ? <p className="p-6 text-center text-sm text-gray-400">Aucune promotion.</p> : null}>
            {(promotions.data || []).map((p) => (
              <tr key={p.id}>
                <td className="max-w-[16rem] truncate px-5 py-3">{p.property?.title}</td>
                <td className="px-5 py-3">{p.kind === 'sponsored' ? 'Sponsorisé' : 'Premium'} · {p.duration_days} j{p.subscription_id ? ' (crédit)' : ''}</td>
                <td className="px-5 py-3">{p.starts_at ? formatDate(p.starts_at) : '—'}</td>
                <td className="px-5 py-3">{p.ends_at ? formatDate(p.ends_at) : '—'}</td>
                <td className="px-5 py-3"><StatusBadge status={p.status} label={PROMOTION_STATUS_LABELS[p.status]} /></td>
                <td className="px-5 py-3">
                  {['active', 'scheduled'].includes(p.status) && (
                    <Button size="sm" variant="ghost" icon={<Ban className="h-4 w-4" />} onClick={() => setTarget(p)}>Annuler</Button>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
      <ConfirmDialog
        isOpen={!!target}
        title="Annuler la promotion"
        description="La visibilité payante est retirée immédiatement. Pensez à rembourser le paiement associé si nécessaire."
        inputLabel="Motif"
        tone="danger"
        isLoading={cancel.isPending}
        error={cancel.isError ? errorMessage(cancel.error) : null}
        onClose={() => setTarget(null)}
        onConfirm={(reason) => target && cancel.mutate({ id: target.id, reason }, { onSuccess: () => setTarget(null) })}
      />
    </div>
  );
}
