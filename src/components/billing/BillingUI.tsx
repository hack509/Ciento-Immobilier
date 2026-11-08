import type { ReactNode } from 'react';
import { Check, Smartphone, Landmark, CreditCard, FlaskConical } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { cn, formatPrice } from '@/lib/utils';
import { planPrice, statusTone, yearlySavingPercent, formatLimit } from '@/lib/monetization';
import type { BillingCycle, SubscriptionPlan } from '@/types/marketplace';
import type { CheckoutProvider } from '@/services/billing.service';

/** Coloured status pill with a French label. */
export function StatusBadge({ status, label }: { status: string; label: string }) {
  return <Badge variant={statusTone(status)}>{label}</Badge>;
}

/** Simulation is only listed in development builds (and refused server-side in production). */
const PROVIDERS: { value: CheckoutProvider; label: string; hint: string; icon: typeof Smartphone; devOnly?: boolean }[] = [
  { value: 'moncash', label: 'MonCash', hint: 'Paiement mobile Digicel (HTG)', icon: Smartphone },
  { value: 'manual', label: 'Virement ou espèces', hint: 'Validé par notre équipe à réception', icon: Landmark },
  { value: 'card', label: 'Carte bancaire', hint: 'Bientôt disponible', icon: CreditCard },
  { value: 'simulated', label: 'Paiement simulé', hint: 'Développement uniquement', icon: FlaskConical, devOnly: true },
];

export function PaymentMethodPicker({ value, onChange }: { value: CheckoutProvider; onChange: (v: CheckoutProvider) => void }) {
  const providers = PROVIDERS.filter((p) => !p.devOnly || import.meta.env.DEV);
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-primary-900">Moyen de paiement</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {providers.map((p) => {
          const disabled = p.value === 'card';
          const selected = value === p.value;
          return (
            <label
              key={p.value}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors',
                selected ? 'border-secondary-500 bg-secondary-50 ring-2 ring-secondary-500/30' : 'border-gray-200 hover:border-primary-300',
                disabled && 'cursor-not-allowed opacity-50',
              )}
            >
              <input
                type="radio"
                name="provider"
                value={p.value}
                checked={selected}
                disabled={disabled}
                onChange={() => onChange(p.value)}
                className="sr-only"
              />
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-brand-blue">
                <p.icon className="h-4.5 w-4.5" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-primary-900">{p.label}</span>
                <span className="block text-xs text-gray-500">{p.hint}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function CycleToggle({ value, onChange, saving }: { value: BillingCycle; onChange: (v: BillingCycle) => void; saving?: number }) {
  return (
    <div role="group" aria-label="Période de facturation" className="inline-flex rounded-full bg-white/10 p-1 ring-1 ring-inset ring-primary-200/40">
      {(['monthly', 'yearly'] as const).map((cycle) => (
        <button
          key={cycle}
          type="button"
          aria-pressed={value === cycle}
          onClick={() => onChange(cycle)}
          className={cn(
            'min-h-[40px] rounded-full px-4 text-sm font-semibold transition-colors',
            value === cycle ? 'bg-brand-yellow text-primary-900 shadow' : 'text-primary-700 hover:text-primary-900',
          )}
        >
          {cycle === 'monthly' ? 'Mensuel' : 'Annuel'}
          {cycle === 'yearly' && saving ? <span className="ml-1.5 text-xs">−{saving}%</span> : null}
        </button>
      ))}
    </div>
  );
}

export function PlanCard({ plan, cycle, current, action }: {
  plan: SubscriptionPlan; cycle: BillingCycle; current?: boolean; action: ReactNode;
}) {
  const price = planPrice(plan, cycle);
  const saving = yearlySavingPercent(plan);
  return (
    <article className={cn(
      'relative flex flex-col rounded-3xl border bg-white p-6 shadow-card',
      plan.is_highlighted ? 'border-brand-blue ring-2 ring-brand-blue/20 lg:-translate-y-2' : 'border-gray-100',
    )}>
      {plan.is_highlighted && (
        <span className="absolute -top-3 left-6 rounded-full bg-brand-yellow px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary-900">
          Recommandé
        </span>
      )}
      <p className="eyebrow">{plan.tier}</p>
      <h3 className="mt-1 text-2xl font-bold text-primary-900">{plan.name}</h3>
      {plan.description && <p className="mt-2 text-sm text-gray-500">{plan.description}</p>}
      <p className="mt-5">
        <span className="font-display text-4xl font-extrabold text-primary-900">{formatPrice(price, plan.currency)}</span>
        <span className="text-sm text-gray-500"> / {cycle === 'yearly' ? 'an' : 'mois'}</span>
      </p>
      {cycle === 'yearly' && saving > 0 && <p className="mt-1 text-xs font-semibold text-success-700">Économisez {saving}% par rapport au mensuel</p>}
      {plan.trial_days > 0 && <p className="mt-1 text-xs font-medium text-brand-blue">{plan.trial_days} jours d’essai gratuit</p>}

      <ul className="mt-6 space-y-2.5 text-sm text-gray-700">
        <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-success-600" />{formatLimit(plan.max_active_listings, 'annonces actives')}</li>
        {plan.featured_credits_per_period > 0 && (
          <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-success-600" />{plan.featured_credits_per_period} mises en avant incluses / période</li>
        )}
        {plan.max_members !== 0 && (
          <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-success-600" />{formatLimit(plan.max_members, 'membres d’équipe')}</li>
        )}
        {plan.features.map((feature) => (
          <li key={feature} className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-success-600" />{feature}</li>
        ))}
      </ul>
      <div className="mt-auto pt-6">
        {current ? <p className="rounded-xl bg-success-50 py-3 text-center text-sm font-semibold text-success-700">Votre formule actuelle</p> : action}
      </div>
    </article>
  );
}

export function ScopeSwitcher({ agencyName, isAgencyScope, onChange }: {
  agencyName?: string; isAgencyScope: boolean; onChange: (scope: 'personal' | 'agency') => void;
}) {
  if (!agencyName) return null;
  return (
    <div role="group" aria-label="Espace" className="inline-flex rounded-xl bg-primary-50 p-1">
      {[
        { key: 'personal' as const, label: 'Espace personnel', active: !isAgencyScope },
        { key: 'agency' as const, label: agencyName, active: isAgencyScope },
      ].map((option) => (
        <button
          key={option.key}
          type="button"
          aria-pressed={option.active}
          onClick={() => onChange(option.key)}
          className={cn(
            'min-h-[40px] max-w-[14rem] truncate rounded-lg px-3 text-sm font-semibold transition-colors',
            option.active ? 'bg-white text-primary-900 shadow-sm' : 'text-primary-600 hover:text-primary-900',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Responsive table wrapper used by dashboard and admin lists. */
export function DataTable({ headers, children, empty }: { headers: string[]; children: ReactNode; empty?: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
          <tr>{headers.map((h) => <th key={h} scope="col" className="px-5 py-3 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-gray-50">{children}</tbody>
      </table>
      {empty}
    </div>
  );
}
