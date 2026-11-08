import { useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { PageHeader, Panel, FilterTabs } from '@/components/dashboard/DashboardUI';
import { DataTable, StatusBadge } from '@/components/billing/BillingUI';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { TextArea } from '@/components/ui/TextArea';
import { Switch } from '@/components/ui/Switch';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useAdminMutation, useAdminQuery } from '@/hooks/useAdminMarketplace';
import { adminMarketplaceService } from '@/services/admin-marketplace.service';
import { BILLING_CYCLE_LABELS, SUBSCRIPTION_STATUS_LABELS, errorMessage } from '@/lib/monetization';
import { formatDate, formatPrice } from '@/lib/utils';
import type { SubscriptionPlan, SubscriptionStatus } from '@/types/marketplace';

const CAPABILITIES = [
  ['basic_stats', 'Statistiques de base'], ['advanced_stats', 'Statistiques avancées'], ['portfolio', 'Portefeuille'],
  ['lead_management', 'Gestion des prospects'], ['multi_user', 'Multi-utilisateurs'], ['custom_page', 'Page personnalisée'],
  ['priority_support', 'Support prioritaire'], ['detailed_stats', 'Statistiques détaillées'],
] as const;

type PlanDraft = Partial<SubscriptionPlan> & { featuresText?: string };

const NEW_PLAN: PlanDraft = {
  code: '', name: '', tier: 'starter', audience: 'all', price_monthly: 0, price_yearly: 0, currency: 'HTG',
  max_active_listings: 10, featured_credits_per_period: 0, max_members: 1, trial_days: 0, capabilities: {},
  featuresText: '', is_active: false, is_public: true, is_highlighted: false, sort_order: 10,
};

/** Empty input = unlimited (NULL). */
const numOrNull = (v: string) => (v.trim() === '' ? null : Math.max(0, Number(v)));

export function AdminSubscriptions() {
  const [status, setStatus] = useState<SubscriptionStatus | ''>('active');
  const plans = useAdminQuery(['plans'], () => adminMarketplaceService.getAllPlans());
  const subs = useAdminQuery(['subscriptions', status], () => adminMarketplaceService.getSubscriptions(status));
  const save = useAdminMutation((plan: PlanDraft) => {
    const { featuresText, ...values } = plan;
    return adminMarketplaceService.savePlan({
      ...values,
      features: (featuresText ?? '').split('\n').map((f) => f.trim()).filter(Boolean),
    });
  });
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const set = <K extends keyof PlanDraft>(key: K, value: PlanDraft[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d));

  return (
    <div>
      <PageHeader
        title="Abonnements & formules"
        subtitle="Les prix, limites et fonctionnalités sont définis ici, jamais dans le code."
        actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setDraft({ ...NEW_PLAN })}>Nouvelle formule</Button>}
      />

      <Panel title="Formules">
        {plans.isLoading ? <LoadingSpinner className="py-12" /> : (
          <DataTable headers={['Formule', 'Public', 'Mensuel', 'Annuel', 'Annonces', 'Membres', 'Crédits', 'État', '']}>
            {(plans.data || []).map((p) => (
              <tr key={p.id}>
                <td className="px-5 py-3"><p className="font-semibold text-primary-900">{p.name}</p><p className="text-xs text-gray-500">{p.code} · {p.tier}</p></td>
                <td className="px-5 py-3 text-xs">{p.audience === 'all' ? 'Tous' : p.audience === 'agency' ? 'Agences' : 'Propriétaires'}</td>
                <td className="px-5 py-3 tabular-nums">{formatPrice(p.price_monthly, p.currency)}</td>
                <td className="px-5 py-3 tabular-nums">{formatPrice(p.price_yearly, p.currency)}</td>
                <td className="px-5 py-3">{p.max_active_listings ?? '∞'}</td>
                <td className="px-5 py-3">{p.max_members ?? '∞'}</td>
                <td className="px-5 py-3">{p.featured_credits_per_period}</td>
                <td className="px-5 py-3"><StatusBadge status={p.is_active ? 'active' : 'cancelled'} label={p.is_active ? 'Active' : 'Inactive'} /></td>
                <td className="px-5 py-3"><Button size="sm" variant="ghost" icon={<Pencil className="h-4 w-4" />}
                  onClick={() => setDraft({ ...p, featuresText: p.features.join('\n') })}>Modifier</Button></td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>

      <Panel title="Abonnés" className="mt-6" action={
        <FilterTabs label="Statut" value={status} onChange={setStatus} options={[
          { value: 'active', label: 'Actifs' }, { value: 'trialing', label: 'Essai' }, { value: 'expired', label: 'Expirés' },
          { value: 'cancelled', label: 'Annulés' }, { value: '', label: 'Tous' },
        ]} />
      }>
        {subs.isLoading ? <LoadingSpinner className="py-12" /> : (
          <DataTable headers={['Abonné', 'Formule', 'Cycle', 'Montant', 'Fin de période', 'Statut']}
            empty={(subs.data || []).length === 0 ? <p className="p-6 text-center text-sm text-gray-400">Aucun abonnement.</p> : null}>
            {(subs.data || []).map((s) => (
              <tr key={s.id}>
                <td className="px-5 py-3">{s.agency ? <><p className="font-medium">{s.agency.name}</p><p className="text-xs text-gray-500">Agence</p></> :
                  <><p className="font-medium">{s.user?.first_name} {s.user?.last_name}</p><p className="text-xs text-gray-500">{s.user?.email}</p></>}</td>
                <td className="px-5 py-3">{s.plan?.name}</td>
                <td className="px-5 py-3">{BILLING_CYCLE_LABELS[s.billing_cycle]}</td>
                <td className="px-5 py-3 tabular-nums">{formatPrice(s.price_amount, s.currency)}</td>
                <td className="px-5 py-3">{s.current_period_end ? formatDate(s.current_period_end) : '—'}{s.cancel_at_period_end && <span className="block text-xs text-warning-700">Non renouvelé</span>}</td>
                <td className="px-5 py-3"><StatusBadge status={s.status} label={SUBSCRIPTION_STATUS_LABELS[s.status]} /></td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>

      <Modal isOpen={!!draft} onClose={() => setDraft(null)} title={draft?.id ? `Modifier ${draft.name}` : 'Nouvelle formule'} className="max-w-2xl">
        {draft && (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(draft, { onSuccess: () => setDraft(null) }); }}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Code (unique)" value={draft.code} onChange={(e) => set('code', e.target.value.toLowerCase())} required pattern="[a-z0-9_-]{2,40}" disabled={!!draft.id} />
              <Input label="Nom" value={draft.name} onChange={(e) => set('name', e.target.value)} required />
              <Select label="Niveau" value={draft.tier} onChange={(e) => set('tier', e.target.value as SubscriptionPlan['tier'])}
                options={[{ value: 'starter', label: 'Starter' }, { value: 'business', label: 'Business' }, { value: 'enterprise', label: 'Enterprise' }]} />
              <Select label="Public" value={draft.audience} onChange={(e) => set('audience', e.target.value as SubscriptionPlan['audience'])}
                options={[{ value: 'all', label: 'Tous' }, { value: 'owner', label: 'Propriétaires' }, { value: 'agency', label: 'Agences' }]} />
              <Input label="Prix mensuel" type="number" min={0} step="0.01" value={draft.price_monthly} onChange={(e) => set('price_monthly', Number(e.target.value))} />
              <Input label="Prix annuel" type="number" min={0} step="0.01" value={draft.price_yearly} onChange={(e) => set('price_yearly', Number(e.target.value))} />
              <Select label="Devise" value={draft.currency} onChange={(e) => set('currency', e.target.value)} options={[{ value: 'HTG', label: 'HTG' }, { value: 'USD', label: 'USD' }]} />
              <Input label="Jours d’essai" type="number" min={0} max={90} value={draft.trial_days} onChange={(e) => set('trial_days', Number(e.target.value))} />
              <Input label="Annonces actives max" type="number" min={0} value={draft.max_active_listings ?? ''} helperText="Vide = illimité" onChange={(e) => set('max_active_listings', numOrNull(e.target.value))} />
              <Input label="Membres max" type="number" min={0} value={draft.max_members ?? ''} helperText="Vide = illimité" onChange={(e) => set('max_members', numOrNull(e.target.value))} />
              <Input label="Crédits de mise en avant / période" type="number" min={0} value={draft.featured_credits_per_period} onChange={(e) => set('featured_credits_per_period', Number(e.target.value))} />
              <Input label="Ordre d’affichage" type="number" value={draft.sort_order} onChange={(e) => set('sort_order', Number(e.target.value))} />
            </div>
            <TextArea label="Description" rows={2} value={draft.description ?? ''} onChange={(e) => set('description', e.target.value)} />
            <TextArea label="Avantages affichés (un par ligne)" rows={4} value={draft.featuresText} onChange={(e) => set('featuresText', e.target.value)} />
            <fieldset className="grid gap-2 sm:grid-cols-2">
              <legend className="mb-2 text-sm font-semibold text-primary-900">Fonctionnalités activées</legend>
              {CAPABILITIES.map(([key, label]) => (
                <Switch key={key} label={label} checked={Boolean(draft.capabilities?.[key])}
                  onChange={(v) => set('capabilities', { ...(draft.capabilities || {}), [key]: v })} />
              ))}
            </fieldset>
            <div className="flex flex-wrap gap-6 border-t border-gray-100 pt-4">
              <Switch label="Active (vendable)" checked={!!draft.is_active} onChange={(v) => set('is_active', v)} />
              <Switch label="Visible sur la page Tarifs" checked={!!draft.is_public} onChange={(v) => set('is_public', v)} />
              <Switch label="Recommandée" checked={!!draft.is_highlighted} onChange={(v) => set('is_highlighted', v)} />
            </div>
            {save.isError && <p role="alert" className="rounded-lg bg-danger-50 p-3 text-sm text-danger-600">{errorMessage(save.error)}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setDraft(null)}>Annuler</Button>
              <Button type="submit" isLoading={save.isPending}>Enregistrer</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
