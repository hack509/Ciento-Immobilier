import { useState } from 'react';
import { Eye, Heart, MessageSquare, Building2, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader, Panel, StatCard, FilterTabs } from '@/components/dashboard/DashboardUI';
import { ScopeSwitcher, DataTable, StatusBadge } from '@/components/billing/BillingUI';
import { BarChart } from '@/components/dashboard/BarChart';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/Button';
import { useAccountScope, useListingStats, useQuota } from '@/hooks/useMarketplace';
import { isActiveUntil } from '@/lib/monetization';
import { getStatusLabel } from '@/lib/utils';

/** Fills missing days so the chart shows a continuous period. */
function continuousDays(daily: { day: string; views: number }[], days: number) {
  const byDay = new Map(daily.map((d) => [d.day, d.views]));
  const result: { label: string; value: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = date.toISOString().slice(0, 10);
    result.push({ label: date.toLocaleDateString('fr-HT', { day: 'numeric', month: 'short' }), value: byDay.get(key) ?? 0 });
  }
  return result;
}

export function Statistics() {
  const scope = useAccountScope();
  const [days, setDays] = useState<'7' | '30' | '90'>('30');
  const { data: stats, isLoading } = useListingStats(scope.agencyId, Number(days));
  const { data: quota } = useQuota(scope.agencyId);
  // Advanced statistics (period > 7 days) are a plan capability; the basic view stays free.
  const advanced = Boolean(quota?.capabilities?.advanced_stats);
  const effectiveDays = advanced ? Number(days) : 7;

  return (
    <div>
      <PageHeader
        title="Statistiques"
        subtitle="Visibilité et performance de vos annonces."
        actions={<ScopeSwitcher agencyName={scope.membership?.agency.name} isAgencyScope={scope.isAgencyScope} onChange={scope.setScope} />}
      />
      {isLoading || !stats ? (
        <LoadingSpinner className="py-24" />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard icon={Building2} label="Annonces en ligne" value={stats.totals.active} hint={`${stats.totals.listings} au total`} tone="navy" />
            <StatCard icon={Eye} label="Vues" value={stats.totals.views} tone="light" />
            <StatCard icon={Heart} label="Favoris" value={stats.totals.favorites} tone="light" />
            <StatCard icon={MessageSquare} label="Demandes de contact" value={stats.totals.inquiries} tone="gold" />
          </div>

          <Panel
            title="Vues par jour"
            action={advanced ? (
              <FilterTabs label="Période" value={days} onChange={setDays}
                options={[{ value: '7', label: '7 j' }, { value: '30', label: '30 j' }, { value: '90', label: '90 j' }]} />
            ) : null}
          >
            <div className="p-5">
              <BarChart title="Vues par jour" data={continuousDays(stats.daily, effectiveDays)} />
              {!advanced && (
                <p className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-primary-50 p-3 text-sm text-primary-800">
                  <Lock className="h-4 w-4" /> Historique sur 30 et 90 jours avec les statistiques avancées.
                  <Link to="/tarifs" className="ml-auto"><Button size="sm" variant="secondary">Voir les formules</Button></Link>
                </p>
              )}
            </div>
          </Panel>

          <Panel title="Performance par annonce">
            <DataTable headers={['Annonce', 'Statut', 'Vues', 'Favoris', 'Contacts', 'Visibilité']}>
              {stats.listings.map((l) => (
                <tr key={l.id}>
                  <td className="max-w-[16rem] truncate px-5 py-3 font-medium text-primary-900">{l.title}</td>
                  <td className="px-5 py-3"><StatusBadge status={l.status} label={getStatusLabel(l.status)} /></td>
                  <td className="px-5 py-3 tabular-nums">{l.views_count}</td>
                  <td className="px-5 py-3 tabular-nums">{l.favorites_count}</td>
                  <td className="px-5 py-3 tabular-nums">{l.inquiries_count}</td>
                  <td className="px-5 py-3 text-xs">
                    {isActiveUntil(l.sponsored_until) && <span className="mr-1 rounded bg-brand-yellow px-1.5 py-0.5 font-semibold text-primary-900">Sponsorisé</span>}
                    {isActiveUntil(l.premium_until) && <span className="rounded bg-brand-blue px-1.5 py-0.5 font-semibold text-white">Premium</span>}
                  </td>
                </tr>
              ))}
            </DataTable>
          </Panel>
        </div>
      )}
    </div>
  );
}
