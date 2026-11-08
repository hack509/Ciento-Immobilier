import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { BadgeCheck, CalendarClock, RefreshCw, XCircle, RotateCcw } from 'lucide-react';
import { PageHeader, Panel } from '@/components/dashboard/DashboardUI';
import { CycleToggle, PaymentMethodPicker, PlanCard, ScopeSwitcher, StatusBadge } from '@/components/billing/BillingUI';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useAccountScope, useQuota } from '@/hooks/useMarketplace';
import { useCheckout, usePlans, useSubscriptionActions, useSubscriptions } from '@/hooks/useBilling';
import {
  BILLING_CYCLE_LABELS, SUBSCRIPTION_STATUS_LABELS, daysLeft, errorMessage, planPrice, prorationCredit, quotaRatio,
  yearlySavingPercent,
} from '@/lib/monetization';
import { formatDate, formatPrice } from '@/lib/utils';
import type { BillingCycle, SubscriptionPlan } from '@/types/marketplace';
import type { CheckoutProvider } from '@/services/billing.service';

export function Subscription() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const scope = useAccountScope();
  const { data: plans, isLoading: plansLoading } = usePlans();
  const { data: subscriptions, isLoading } = useSubscriptions(scope.agencyId);
  const { data: quota } = useQuota(scope.agencyId);
  const checkout = useCheckout();
  const actions = useSubscriptionActions();

  const [cycle, setCycle] = useState<BillingCycle>((params.get('cycle') as BillingCycle) || 'monthly');
  const [selected, setSelected] = useState<SubscriptionPlan | null>(null);
  const [renewing, setRenewing] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [provider, setProvider] = useState<CheckoutProvider>('moncash');

  const live = useMemo(() => (subscriptions || []).find((s) =>
    ['active', 'trialing', 'past_due'].includes(s.status) && s.current_period_end && new Date(s.current_period_end) > new Date()),
  [subscriptions]);
  const hasHistory = (subscriptions || []).length > 0;
  const audience = scope.isAgencyScope ? 'agency' : 'owner';
  const eligiblePlans = (plans || []).filter((p) => p.audience === 'all' || p.audience === audience);
  const canManage = !scope.isAgencyScope || scope.membership?.canManageBilling;

  // Pre-select the plan chosen on the public pricing page.
  const preselected = params.get('plan');
  const preselectDone = useRef(false);
  useEffect(() => {
    if (!preselected || preselectDone.current || !plans || isLoading) return;
    preselectDone.current = true;
    const plan = plans.find((p) => p.id === preselected);
    if (plan && plan.id !== live?.plan_id) setSelected(plan);
  }, [preselected, plans, isLoading, live?.plan_id]);

  const goToPayment = (paymentId: string, status: string) =>
    navigate(status === 'succeeded' ? '/dashboard/paiements' : `/dashboard/paiement/${paymentId}`);

  const subscribe = () => {
    if (!selected) return;
    checkout.subscription.mutate(
      { planId: selected.id, cycle, provider, agencyId: scope.agencyId },
      { onSuccess: (payment) => goToPayment(payment.id, payment.status) },
    );
  };

  const startTrial = (plan: SubscriptionPlan) =>
    checkout.trial.mutate({ planId: plan.id, cycle, agencyId: scope.agencyId });

  const renew = () => {
    if (!live) return;
    checkout.renewal.mutate({ subscriptionId: live.id, provider }, { onSuccess: (payment) => goToPayment(payment.id, payment.status) });
  };

  const mutationError = checkout.subscription.error || checkout.renewal.error || checkout.trial.error || actions.setCancellation.error;
  const credit = live && live.status === 'active' ? prorationCredit(live.price_amount, live.current_period_start, live.current_period_end) : 0;

  return (
    <div>
      <PageHeader
        title="Abonnement"
        subtitle="Votre formule, vos limites et le renouvellement."
        actions={<ScopeSwitcher agencyName={scope.membership?.agency.name} isAgencyScope={scope.isAgencyScope} onChange={scope.setScope} />}
      />
      {mutationError && <p role="alert" className="mb-4 rounded-lg bg-danger-50 p-3 text-sm text-danger-600">{errorMessage(mutationError)}</p>}
      {checkout.trial.isSuccess && <p role="status" className="mb-4 rounded-lg bg-success-50 p-3 text-sm text-success-700">Votre période d’essai a commencé.</p>}
      {!canManage && (
        <p className="mb-4 rounded-lg bg-warning-50 p-3 text-sm text-warning-700">Seuls les membres autorisés à gérer la facturation peuvent modifier l’abonnement de l’agence.</p>
      )}

      {isLoading ? <LoadingSpinner className="py-16" /> : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Panel title="Formule actuelle" className="lg:col-span-2">
            <div className="p-5">
              {live ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <BadgeCheck className="h-6 w-6 text-success-600" />
                    <span className="text-xl font-bold text-primary-900">{live.plan?.name}</span>
                    <StatusBadge status={live.status} label={SUBSCRIPTION_STATUS_LABELS[live.status]} />
                    <span className="text-sm text-gray-500">{BILLING_CYCLE_LABELS[live.billing_cycle]} · {formatPrice(live.price_amount, live.currency)}</span>
                  </div>
                  <p className="flex items-center gap-2 text-sm text-gray-600">
                    <CalendarClock className="h-4 w-4" />
                    {live.cancel_at_period_end ? 'Se termine' : live.status === 'trialing' ? 'Essai jusqu’au' : 'Renouvellement avant le'} {formatDate(live.current_period_end!)}
                    ({daysLeft(live.current_period_end)} jours)
                  </p>
                  {canManage && (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => setRenewing(true)} icon={<RefreshCw className="h-4 w-4" />}>Renouveler / prolonger</Button>
                      {live.cancel_at_period_end ? (
                        <Button size="sm" variant="outline" icon={<RotateCcw className="h-4 w-4" />} isLoading={actions.setCancellation.isPending}
                          onClick={() => actions.setCancellation.mutate({ subscriptionId: live.id, cancel: false })}>Réactiver</Button>
                      ) : (
                        <Button size="sm" variant="ghost" icon={<XCircle className="h-4 w-4" />} onClick={() => setConfirmCancel(true)}>Annuler à l’échéance</Button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-600">
                  Vous utilisez l’offre gratuite. Choisissez une formule ci-dessous pour publier davantage et accéder aux fonctionnalités professionnelles.
                </p>
              )}
            </div>
          </Panel>

          <Panel title="Utilisation">
            <div className="space-y-4 p-5 text-sm">
              <div>
                <div className="mb-1 flex justify-between"><span>Annonces actives / en attente</span>
                  <span className="font-semibold">{quota?.used ?? '—'} / {quota?.limit ?? '∞'}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-brand-blue" style={{ width: `${quotaRatio(quota?.used ?? 0, quota?.limit) * 100}%` }} />
                </div>
              </div>
              {scope.isAgencyScope && <p>Membres d’équipe : <strong>{quota?.member_limit ?? 'illimité'}</strong></p>}
              <p>Crédits de mise en avant : <strong>{quota?.featured_credits ?? 0}</strong></p>
            </div>
          </Panel>
        </div>
      )}

      <section className="mt-10" aria-labelledby="plans-title">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 id="plans-title" className="text-xl font-bold text-primary-900">{live ? 'Changer de formule' : 'Choisir une formule'}</h2>
          <CycleToggle value={cycle} onChange={setCycle} saving={Math.max(0, ...eligiblePlans.map(yearlySavingPercent))} />
        </div>
        {plansLoading ? <LoadingSpinner /> : eligiblePlans.length === 0 ? (
          <p className="rounded-2xl bg-white p-6 text-sm text-gray-500 shadow-card">Aucune formule n’est encore proposée. <Link to="/contact" className="text-brand-blue underline">Contactez-nous</Link>.</p>
        ) : (
          <div className="grid gap-5 lg:grid-cols-3">
            {eligiblePlans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} cycle={cycle}
                current={live?.plan_id === plan.id && live.billing_cycle === cycle}
                action={canManage ? (
                  <div className="space-y-2">
                    <Button className="w-full" variant={plan.is_highlighted ? 'primary' : 'secondary'} onClick={() => setSelected(plan)}>
                      {live ? 'Passer à cette formule' : 'Souscrire'}
                    </Button>
                    {!hasHistory && plan.trial_days > 0 && (
                      <Button className="w-full" variant="outline" isLoading={checkout.trial.isPending} onClick={() => startTrial(plan)}>
                        Essai gratuit {plan.trial_days} jours
                      </Button>
                    )}
                  </div>
                ) : null}
              />
            ))}
          </div>
        )}
      </section>

      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title={`Formule ${selected?.name ?? ''}`}>
        {selected && (
          <div className="space-y-5">
            <div className="rounded-xl bg-primary-50 p-4 text-sm">
              <p className="flex justify-between"><span>{BILLING_CYCLE_LABELS[cycle]}</span><strong>{formatPrice(planPrice(selected, cycle), selected.currency)}</strong></p>
              {credit > 0 && <p className="mt-1 flex justify-between text-success-700"><span>Crédit restant de votre formule actuelle (estimation)</span><span>− {formatPrice(credit, selected.currency)}</span></p>}
              <p className="mt-2 text-xs text-gray-500">Le montant définitif est calculé par le serveur au moment du paiement.</p>
            </div>
            <PaymentMethodPicker value={provider} onChange={setProvider} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setSelected(null)}>Annuler</Button>
              <Button onClick={subscribe} isLoading={checkout.subscription.isPending}>Continuer vers le paiement</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={renewing} onClose={() => setRenewing(false)} title="Renouveler l’abonnement">
        <div className="space-y-5">
          <p className="text-sm text-gray-600">La nouvelle période s’ajoute à la fin de la période en cours.</p>
          <PaymentMethodPicker value={provider} onChange={setProvider} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRenewing(false)}>Annuler</Button>
            <Button onClick={renew} isLoading={checkout.renewal.isPending}>Continuer vers le paiement</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={confirmCancel}
        title="Annuler l’abonnement ?"
        description="Votre formule reste active jusqu’à la fin de la période payée, puis ne sera pas renouvelée. Vous pourrez la réactiver d’ici là."
        confirmLabel="Annuler à l’échéance"
        tone="danger"
        isLoading={actions.setCancellation.isPending}
        onClose={() => setConfirmCancel(false)}
        onConfirm={() => live && actions.setCancellation.mutate(
          { subscriptionId: live.id, cancel: true }, { onSuccess: () => setConfirmCancel(false) })}
      />
    </div>
  );
}
