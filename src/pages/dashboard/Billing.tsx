import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Printer, FileText } from 'lucide-react';
import { PageHeader, Panel } from '@/components/dashboard/DashboardUI';
import { DataTable, ScopeSwitcher, StatusBadge } from '@/components/billing/BillingUI';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useAccountScope } from '@/hooks/useMarketplace';
import { useInvoices, usePayments } from '@/hooks/useBilling';
import { PAYMENT_PROVIDER_LABELS, PAYMENT_PURPOSE_LABELS, PAYMENT_STATUS_LABELS } from '@/lib/monetization';
import { formatDate, formatPrice } from '@/lib/utils';
import { APP_NAME, CONTACT_EMAIL } from '@/lib/constants';
import type { Invoice } from '@/types/marketplace';

export function Billing() {
  const scope = useAccountScope();
  const { data: payments, isLoading } = usePayments(scope.agencyId);
  const { data: invoices } = useInvoices(scope.agencyId);
  const [invoice, setInvoice] = useState<Invoice | null>(null);

  return (
    <div>
      <PageHeader
        title="Factures & paiements"
        subtitle="Historique de vos transactions et factures."
        actions={<ScopeSwitcher agencyName={scope.membership?.canManageBilling ? scope.membership.agency.name : undefined} isAgencyScope={scope.isAgencyScope} onChange={scope.setScope} />}
      />

      <Panel title="Transactions">
        {isLoading ? <LoadingSpinner className="py-12" /> : (
          <DataTable headers={['Date', 'Objet', 'Moyen', 'Montant', 'Statut', '']}
            empty={(payments || []).length === 0 ? <p className="p-6 text-center text-sm text-gray-400">Aucune transaction.</p> : null}>
            {(payments || []).map((p) => (
              <tr key={p.id}>
                <td className="whitespace-nowrap px-5 py-3">{formatDate(p.created_at)}</td>
                <td className="px-5 py-3">
                  <span className="block font-medium text-primary-900">{PAYMENT_PURPOSE_LABELS[p.purpose]}</span>
                  {p.description && <span className="block max-w-[18rem] truncate text-xs text-gray-500">{p.description}</span>}
                </td>
                <td className="px-5 py-3">{PAYMENT_PROVIDER_LABELS[p.provider]}</td>
                <td className="whitespace-nowrap px-5 py-3 font-semibold tabular-nums">{formatPrice(p.amount, p.currency)}</td>
                <td className="px-5 py-3"><StatusBadge status={p.status} label={PAYMENT_STATUS_LABELS[p.status]} /></td>
                <td className="px-5 py-3 text-right">
                  {p.status === 'pending' && <Link to={`/dashboard/paiement/${p.id}`} className="text-sm font-semibold text-brand-blue hover:underline">Finaliser</Link>}
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>

      <Panel title="Factures" className="mt-6">
        <DataTable headers={['N°', 'Date', 'Description', 'Montant', 'Statut', '']}
          empty={(invoices || []).length === 0 ? <p className="p-6 text-center text-sm text-gray-400">Aucune facture.</p> : null}>
          {(invoices || []).map((inv) => (
            <tr key={inv.id}>
              <td className="px-5 py-3 font-mono text-xs">{inv.number}</td>
              <td className="px-5 py-3">{formatDate(inv.issued_at)}</td>
              <td className="max-w-[18rem] truncate px-5 py-3">{inv.description}</td>
              <td className="px-5 py-3 tabular-nums">{formatPrice(inv.amount, inv.currency)}</td>
              <td className="px-5 py-3"><StatusBadge status={inv.status} label={inv.status === 'paid' ? 'Payée' : 'Remboursée'} /></td>
              <td className="px-5 py-3 text-right">
                <Button size="sm" variant="ghost" icon={<FileText className="h-4 w-4" />} onClick={() => setInvoice(inv)}>Voir</Button>
              </td>
            </tr>
          ))}
        </DataTable>
      </Panel>

      <Modal isOpen={!!invoice} onClose={() => setInvoice(null)} title={`Facture ${invoice?.number ?? ''}`} className="max-w-xl">
        {invoice && (
          <div className="space-y-4 text-sm print:text-black" id="invoice-print">
            <div className="flex items-start justify-between">
              <img src="/logo.jpg" alt={APP_NAME} className="h-12 w-auto" />
              <div className="text-right text-xs text-gray-500">
                <p className="font-semibold text-primary-900">{invoice.number}</p>
                <p>Émise le {formatDate(invoice.issued_at)}</p>
              </div>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-xs uppercase text-gray-500">Facturé à</p>
              <p className="font-semibold">{invoice.billing_name}</p>
              <p className="text-gray-600">{invoice.billing_email}</p>
            </div>
            <table className="w-full">
              <tbody>
                <tr className="border-b border-gray-100"><td className="py-2">{invoice.description}</td><td className="py-2 text-right font-semibold">{formatPrice(invoice.amount, invoice.currency)}</td></tr>
                <tr><td className="py-2 font-bold">Total</td><td className="py-2 text-right text-lg font-bold">{formatPrice(invoice.amount, invoice.currency)}</td></tr>
              </tbody>
            </table>
            <p className="text-xs text-gray-500">{invoice.status === 'refunded' ? 'Cette facture a fait l’objet d’un remboursement.' : 'Facture acquittée.'} {APP_NAME} — {CONTACT_EMAIL}</p>
            <div className="flex justify-end print:hidden">
              <Button variant="secondary" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>Imprimer / PDF</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
