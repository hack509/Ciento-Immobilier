import { useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Megaphone, Crown, Sparkles, Gift } from 'lucide-react';
import { PageHeader, Panel } from '@/components/dashboard/DashboardUI';
import { DataTable, PaymentMethodPicker, ScopeSwitcher, StatusBadge } from '@/components/billing/BillingUI';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useAuth } from '@/contexts/AuthContext';
import { useOwnProperties } from '@/hooks/useProperties';
import { useAccountScope, useAgencyPortfolio, useQuota } from '@/hooks/useMarketplace';
import { useCheckout, useOffers, usePromotions, useSubscriptionActions } from '@/hooks/useBilling';
import { PROMOTION_STATUS_LABELS, daysLeft, errorMessage, isPremium, isSponsored } from '@/lib/monetization';
import { formatDate, formatPrice } from '@/lib/utils';
import type { Property } from '@/types';
import type { PromotionKind } from '@/types/marketplace';
import type { CheckoutProvider } from '@/services/billing.service';

export function Promotions() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const scope = useAccountScope();
  const own = useOwnProperties(scope.isAgencyScope ? undefined : user?.id);
  const portfolio = useAgencyPortfolio(scope.agencyId ?? undefined, 'active');
  const { data: quota } = useQuota(scope.agencyId);
  const { data: offers } = useOffers();
  const checkout = useCheckout();
  const actions = useSubscriptionActions();

  const listings: Property[] = useMemo(() => {
    const all = scope.isAgencyScope ? portfolio.data || [] : (own.data?.data || []).filter((p) => !p.agency_id);
    return all.filter((p) => p.status === 'active' && p.is_published);
  }, [scope.isAgencyScope, portfolio.data, own.data]);
  const { data: history } = usePromotions(listings.map((l) => l.id));

  const [target, setTarget] = useState<{ property: Property; kind: PromotionKind } | null>(null);
  const [offerId, setOfferId] = useState('');
  const [provider, setProvider] = useState<CheckoutProvider>('moncash');
  const kindOffers = (offers || []).filter((o) => o.kind === target?.kind);

  const startCheckout = () => {
    if (!target || !offerId) return;
    checkout.promotion.mutate(
      { kind: target.kind, propertyId: target.property.id, offerId, provider },
      { onSuccess: (payment) => navigate(`/dashboard/paiement/${payment.id}`) },
    );
  };

  const isLoading = scope.isAgencyScope ? portfolio.isLoading : own.isLoading;

  return (
    <div>
      <PageHeader
        title="Promotions"
        subtitle="Sponsorisez vos annonces ou activez l’option Premium pour gagner en visibilité."
        actions={<ScopeSwitcher agencyName={scope.membership?.canPublish ? scope.membership.agency.name : undefined} isAgencyScope={scope.isAgencyScope} onChange={scope.setScope} />}
      />

      {(quota?.featured_credits ?? 0) > 0 && (
        <p className="mb-5 flex items-center gap-2 rounded-2xl bg-secondary-50 p-4 text-sm font-medium text-secondary-800">
          <Gift className="h-5 w-5" /> Il vous reste {quota!.featured_credits} crédit(s) de mise en avant inclus dans votre formule.
        </p>
      )}
      {(checkout.promotion.isError || actions.redeemCredit.isError) && (
        <p role="alert" className="mb-4 rounded-lg bg-danger-50 p-3 text-sm text-danger-600">
          {errorMessage(checkout.promotion.error || actions.redeemCredit.error)}
        </p>
      )}

      <Panel title="Vos annonces en ligne">
        {isLoading ? (
          <LoadingSpinner className="py-16" />
        ) : listings.length === 0 ? (
          <EmptyState icon={<Sparkles className="h-7 w-7" />} title="Aucune annonce en ligne"
            description="Seules les annonces validées peuvent être mises en avant."
            action={<Link to="/dashboard/annonces"><Button variant="outline">Mes annonces</Button></Link>} />
        ) : (
          <ul className="divide-y divide-gray-100">
            {listings.map((p) => (
              <li key={p.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-primary-900">{p.title}</p>
                  <p className="mt-1 flex flex-wrap gap-2 text-xs text-gray-500">
                    {isSponsored(p) ? <span className="text-secondary-700">Sponsorisé encore {daysLeft(p.sponsored_until)} j</span> : <span>Non sponsorisé</span>}
                    ·
                    {isPremium(p) ? <span className="text-brand-blue">Premium encore {daysLeft(p.premium_until)} j</span> : <span>Standard</span>}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(quota?.featured_credits ?? 0) > 0 && (
                    <Button size="sm" variant="outline" isLoading={actions.redeemCredit.isPending}
                      onClick={() => actions.redeemCredit.mutate(p.id)} icon={<Gift className="h-4 w-4" />}>
                      Utiliser un crédit
                    </Button>
                  )}
                  <Button size="sm" onClick={() => { setTarget({ property: p, kind: 'sponsored' }); setOfferId(''); }} icon={<Megaphone className="h-4 w-4" />}>
                    Sponsoriser
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => { setTarget({ property: p, kind: 'premium' }); setOfferId(''); }} icon={<Crown className="h-4 w-4" />}>
                    Premium
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Historique des promotions" className="mt-6">
        <DataTable headers={['Annonce', 'Type', 'Durée', 'Début', 'Fin', 'Statut']}
          empty={(history || []).length === 0 ? <p className="p-6 text-center text-sm text-gray-400">Aucune promotion pour le moment.</p> : null}>
          {(history || []).map((h) => (
            <tr key={h.id}>
              <td className="max-w-[14rem] truncate px-5 py-3">{h.property?.title}</td>
              <td className="px-5 py-3">{h.kind === 'sponsored' ? 'Sponsorisé' : 'Premium'}</td>
              <td className="px-5 py-3">{h.duration_days} j</td>
              <td className="px-5 py-3">{h.starts_at ? formatDate(h.starts_at) : '—'}</td>
              <td className="px-5 py-3">{h.ends_at ? formatDate(h.ends_at) : '—'}</td>
              <td className="px-5 py-3"><StatusBadge status={h.status} label={PROMOTION_STATUS_LABELS[h.status]} /></td>
            </tr>
          ))}
        </DataTable>
      </Panel>

      <Modal isOpen={!!target} onClose={() => setTarget(null)} title={target?.kind === 'sponsored' ? 'Sponsoriser l’annonce' : 'Activer l’option Premium'}>
        {target && (
          <div className="space-y-5">
            <p className="text-sm text-gray-600">« {target.property.title} »</p>
            {kindOffers.length === 0 ? (
              <p className="rounded-lg bg-warning-50 p-3 text-sm text-warning-700">Aucune offre n’est disponible pour le moment.</p>
            ) : (
              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-primary-900">Durée</legend>
                <div className="grid grid-cols-3 gap-2">
                  {kindOffers.map((o) => (
                    <label key={o.id} className={`cursor-pointer rounded-xl border p-3 text-center ${offerId === o.id ? 'border-secondary-500 bg-secondary-50 ring-2 ring-secondary-500/30' : 'border-gray-200'}`}>
                      <input type="radio" name="offer" className="sr-only" checked={offerId === o.id} onChange={() => setOfferId(o.id)} />
                      <span className="block text-sm font-semibold">{o.duration_days} jours</span>
                      <span className="block text-xs text-gray-500">{formatPrice(o.price, o.currency)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <PaymentMethodPicker value={provider} onChange={setProvider} />
            <p className="text-xs text-gray-500">La promotion démarre dès la confirmation du paiement (ou à la fin d’une promotion en cours).</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setTarget(null)}>Annuler</Button>
              <Button onClick={startCheckout} disabled={!offerId} isLoading={checkout.promotion.isPending}>Continuer vers le paiement</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
