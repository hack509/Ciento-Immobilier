import { useState } from 'react';
import { Banknote, Repeat, Undo2, AlertTriangle } from 'lucide-react';
import { PageHeader, Panel, StatCard } from '@/components/dashboard/DashboardUI';
import { DataTable } from '@/components/billing/BillingUI';
import { BarChart } from '@/components/dashboard/BarChart';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useAdminQuery } from '@/hooks/useAdminMarketplace';
import { adminMarketplaceService } from '@/services/admin-marketplace.service';
import { PAYMENT_PROVIDER_LABELS, PAYMENT_PURPOSE_LABELS } from '@/lib/monetization';
import { formatPrice } from '@/lib/utils';

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function AdminFinance() {
  const today = new Date();
  const [from, setFrom] = useState(iso(new Date(today.getFullYear(), today.getMonth() - 11, 1)));
  const [to, setTo] = useState(iso(today));
  const { data: report, isLoading } = useAdminQuery(['finance', from, to], () => adminMarketplaceService.getFinancialReport(from, to), from <= to);

  const htg = report?.totals.find((t) => t.currency === 'HTG');
  const mrr = report?.recurring.find((r) => r.currency === 'HTG');
  const monthly = (report?.by_month || []).filter((m) => m.currency === 'HTG').map((m) => ({ label: m.month, value: Number(m.revenue) }));

  return (
    <div>
      <PageHeader title="Rapports financiers" subtitle="Revenus confirmés par période, source et moyen de paiement (HTG)."
        actions={
          <div className="flex gap-2">
            <Input aria-label="Du" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
            <Input aria-label="Au" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </div>
        } />
      {isLoading || !report ? <LoadingSpinner className="py-24" /> : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard icon={Banknote} label="Revenus (HTG)" value={Number(htg?.revenue ?? 0)} hint={`${htg?.payments ?? 0} paiement(s)`} tone="navy" />
            <StatCard icon={Repeat} label="Revenu mensuel récurrent" value={Number(mrr?.mrr ?? 0)} hint={`${mrr?.subscriptions ?? 0} abonnement(s) actif(s)`} tone="gold" />
            <StatCard icon={Undo2} label="Remboursés (HTG)" value={Number(htg?.refunded ?? 0)} />
            <StatCard icon={AlertTriangle} label="Paiements échoués" value={report.failed_payments} tone="warning" />
          </div>
          {report.totals.some((t) => t.currency !== 'HTG') && (
            <p className="rounded-xl bg-primary-50 p-3 text-sm text-primary-800">
              Autres devises : {report.totals.filter((t) => t.currency !== 'HTG').map((t) => formatPrice(Number(t.revenue ?? 0), t.currency)).join(' · ')}
            </p>
          )}
          <Panel title="Revenus mensuels (HTG)">
            <div className="p-5"><BarChart title="Revenus mensuels en HTG" data={monthly} formatValue={(v) => formatPrice(v, 'HTG')} /></div>
          </Panel>
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Par source de revenus">
              <DataTable headers={['Source', 'Paiements', 'Montant']}>
                {report.by_purpose.map((r) => (
                  <tr key={`${r.purpose}-${r.currency}`}>
                    <td className="px-5 py-3">{PAYMENT_PURPOSE_LABELS[r.purpose]}</td>
                    <td className="px-5 py-3 tabular-nums">{r.payments}</td>
                    <td className="px-5 py-3 font-semibold tabular-nums">{formatPrice(Number(r.revenue), r.currency)}</td>
                  </tr>
                ))}
              </DataTable>
            </Panel>
            <Panel title="Par moyen de paiement">
              <DataTable headers={['Moyen', 'Paiements', 'Montant']}>
                {report.by_provider.map((r) => (
                  <tr key={r.provider}>
                    <td className="px-5 py-3">{PAYMENT_PROVIDER_LABELS[r.provider]}</td>
                    <td className="px-5 py-3 tabular-nums">{r.payments}</td>
                    <td className="px-5 py-3 font-semibold tabular-nums">{Number(r.revenue).toLocaleString('fr-HT')}</td>
                  </tr>
                ))}
              </DataTable>
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}
