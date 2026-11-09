import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeDollarSign, Megaphone, Crown, ShieldCheck, Check, X } from 'lucide-react';
import { PageHero } from '@/components/ui/PageHero';
import { Head } from '@/components/seo/Head';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { CycleToggle, PlanCard } from '@/components/billing/BillingUI';
import { usePlans, useOffers } from '@/hooks/useBilling';
import { useAuth } from '@/contexts/AuthContext';
import { formatPrice } from '@/lib/utils';
import { yearlySavingPercent } from '@/lib/monetization';
import type { BillingCycle, SubscriptionPlan } from '@/types/marketplace';

/** Capabilities compared across plans (labels only; values come from the database). */
const CAPABILITY_ROWS: { key: string; label: string }[] = [
  { key: 'basic_stats', label: 'Statistiques de base' },
  { key: 'advanced_stats', label: 'Statistiques avancées' },
  { key: 'portfolio', label: 'Gestion du portefeuille' },
  { key: 'lead_management', label: 'Gestion des prospects' },
  { key: 'multi_user', label: 'Multi-utilisateurs & agents' },
  { key: 'custom_page', label: 'Page d’agence personnalisée' },
  { key: 'priority_support', label: 'Support prioritaire' },
];

function ComparisonTable({ plans }: { plans: SubscriptionPlan[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-card">
      <table className="w-full min-w-[640px] text-sm">
        <caption className="sr-only">Comparaison des formules</caption>
        <thead>
          <tr className="border-b border-gray-100">
            <th scope="col" className="px-5 py-4 text-left font-semibold text-gray-500">Fonctionnalité</th>
            {plans.map((p) => <th key={p.id} scope="col" className="px-5 py-4 text-center font-bold text-primary-900">{p.name}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          <tr>
            <th scope="row" className="px-5 py-3 text-left font-medium text-gray-700">Annonces actives</th>
            {plans.map((p) => <td key={p.id} className="px-5 py-3 text-center">{p.max_active_listings ?? 'Illimité'}</td>)}
          </tr>
          <tr>
            <th scope="row" className="px-5 py-3 text-left font-medium text-gray-700">Membres d’équipe</th>
            {plans.map((p) => <td key={p.id} className="px-5 py-3 text-center">{p.max_members ?? 'Illimité'}</td>)}
          </tr>
          <tr>
            <th scope="row" className="px-5 py-3 text-left font-medium text-gray-700">Mises en avant incluses</th>
            {plans.map((p) => <td key={p.id} className="px-5 py-3 text-center">{p.featured_credits_per_period}</td>)}
          </tr>
          {CAPABILITY_ROWS.map((row) => (
            <tr key={row.key}>
              <th scope="row" className="px-5 py-3 text-left font-medium text-gray-700">{row.label}</th>
              {plans.map((p) => (
                <td key={p.id} className="px-5 py-3 text-center">
                  {p.capabilities[row.key]
                    ? <Check className="mx-auto h-5 w-5 text-success-600" aria-label="Inclus" />
                    : <X className="mx-auto h-5 w-5 text-gray-300" aria-label="Non inclus" />}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pricing() {
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const { isAuthenticated } = useAuth();
  const { data: plans, isLoading } = usePlans();
  const { data: offers } = useOffers();
  const bestSaving = Math.max(0, ...(plans || []).map(yearlySavingPercent));
  const subscribeLink = (planId: string) =>
    isAuthenticated ? `/dashboard/abonnement?plan=${planId}&cycle=${cycle}` : '/auth/inscription';

  return (
    <>
      <Head
        title="Tarifs professionnels"
        description="Formules Starter, Business et Enterprise pour les agences et propriétaires professionnels. Annonces sponsorisées et options Premium."
        url="/tarifs"
      />
      <PageHero
        eyebrow="Espace professionnel"
        icon={BadgeDollarSign}
        title="Des formules pour"
        highlight="développer votre activité"
        subtitle="La consultation des annonces reste 100 % gratuite pour les visiteurs. Les professionnels choisissent la formule adaptée à leur portefeuille."
        breadcrumbs={[{ label: 'Accueil', to: '/' }, { label: 'Tarifs' }]}
        align="center"
        overlap
      />

      <div className="bg-gray-50 pb-20">
        <div className="mx-auto -mt-10 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex justify-center">
            <div className="rounded-full bg-white p-1 shadow-card">
              <CycleToggle value={cycle} onChange={setCycle} saving={bestSaving} />
            </div>
          </div>

          {isLoading ? (
            <LoadingSpinner size="lg" className="py-24" text="Chargement des formules…" />
          ) : plans && plans.length > 0 ? (
            <>
              <div className="grid gap-6 lg:grid-cols-3">
                {plans.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    cycle={cycle}
                    action={
                      <Link to={subscribeLink(plan.id)} className="block">
                        <Button className="w-full" variant={plan.is_highlighted ? 'primary' : 'secondary'}>
                          {plan.trial_days > 0 ? 'Commencer l’essai' : 'Choisir cette formule'}
                        </Button>
                      </Link>
                    }
                  />
                ))}
              </div>
              <section className="mt-16" aria-labelledby="compare-title">
                <h2 id="compare-title" className="mb-6 text-2xl font-bold text-primary-900">Comparer les formules</h2>
                <ComparisonTable plans={plans} />
              </section>
            </>
          ) : (
            <EmptyState
              icon={<BadgeDollarSign className="h-7 w-7" />}
              title="Formules bientôt disponibles"
              description="Nos offres professionnelles sont en cours de préparation. Contactez-nous pour un accompagnement personnalisé."
              action={<Link to="/contact"><Button>Nous contacter</Button></Link>}
              className="rounded-3xl bg-white shadow-card"
            />
          )}

          <section className="mt-16 grid gap-6 md:grid-cols-2" aria-label="Options de visibilité">
            {[
              { kind: 'sponsored' as const, icon: Megaphone, title: 'Annonces sponsorisées', desc: 'Votre annonce en tête des résultats et sur la page d’accueil, avec le badge « Sponsorisé ».' },
              { kind: 'premium' as const, icon: Crown, title: 'Option Premium', desc: 'Galerie enrichie, badge Premium, mise en valeur visuelle et informations supplémentaires.' },
            ].map(({ kind, icon: Icon, title, desc }) => {
              const kindOffers = (offers || []).filter((o) => o.kind === kind);
              return (
                <article key={kind} className="rounded-3xl border border-gray-100 bg-white p-6 shadow-card">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-yellow text-primary-900"><Icon className="h-6 w-6" /></span>
                  <h3 className="mt-4 text-xl font-bold text-primary-900">{title}</h3>
                  <p className="mt-2 text-sm text-gray-600">{desc}</p>
                  {kindOffers.length > 0 ? (
                    <ul className="mt-5 grid grid-cols-3 gap-2">
                      {kindOffers.map((o) => (
                        <li key={o.id} className="rounded-xl bg-primary-50 p-3 text-center">
                          <span className="block text-xs text-gray-500">{o.duration_days} jours</span>
                          <span className="block font-bold text-primary-900">{formatPrice(o.price, o.currency)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-5 text-sm text-gray-600">Tarifs communiqués sur demande.</p>
                  )}
                </article>
              );
            })}
          </section>

          <p className="mt-10 flex items-center justify-center gap-2 text-center text-sm text-gray-500">
            <ShieldCheck className="h-4 w-4 text-success-600" />
            Paiement MonCash ou virement. Activation après confirmation du paiement.
          </p>
        </div>
      </div>
    </>
  );
}
