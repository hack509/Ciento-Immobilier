import { useState } from 'react';
import { CheckCircle2, Undo2 } from 'lucide-react';
import { PageHeader, Panel, FilterTabs } from '@/components/dashboard/DashboardUI';
import { DataTable, StatusBadge } from '@/components/billing/BillingUI';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useAdminMutation, useAdminQuery } from '@/hooks/useAdminMarketplace';
import { adminMarketplaceService } from '@/services/admin-marketplace.service';
import { PAYMENT_PROVIDER_LABELS, PAYMENT_PURPOSE_LABELS, PAYMENT_STATUS_LABELS, errorMessage } from '@/lib/monetization';
import { formatDate, formatPrice } from '@/lib/utils';
import type { Payment, PaymentStatus } from '@/types/marketplace';

export function AdminPayments() {
  const [status, setStatus] = useState<PaymentStatus | ''>('pending');
  const { data: payments, isLoading } = useAdminQuery(['payments', status], () => adminMarketplaceService.getPayments(status));
  const confirm = useAdminMutation((v: { id: string; reference: string }) => adminMarketplaceService.confirmPayment(v.id, v.reference));
  const refund = useAdminMutation((v: { id: string; reason: string }) => adminMarketplaceService.refundPayment(v.id, v.reason));
  const [action, setAction] = useState<{ kind: 'confirm' | 'refund'; payment: Payment } | null>(null);
  const mutation = action?.kind === 'refund' ? refund : confirm;

  return (
    <div>
      <PageHeader title="Paiements" subtitle="Confirmation manuelle (virement, espèces), remboursements et historique. Toutes les actions sont journalisées." />
      <div className="mb-4">
        <FilterTabs label="Statut" value={status} onChange={setStatus} options={[
          { value: 'pending', label: 'En attente' }, { value: 'succeeded', label: 'Payés' }, { value: 'failed', label: 'Échoués' },
          { value: 'refunded', label: 'Remboursés' }, { value: '', label: 'Tous' },
        ]} />
      </div>
      <Panel>
        {isLoading ? <LoadingSpinner className="py-16" /> : (
          <DataTable headers={['Date', 'Client', 'Objet', 'Moyen', 'Montant', 'Statut', 'Actions']}
            empty={(payments || []).length === 0 ? <p className="p-6 text-center text-sm text-gray-400">Aucune transaction.</p> : null}>
            {(payments || []).map((p) => (
              <tr key={p.id}>
                <td className="whitespace-nowrap px-5 py-3 text-xs">{formatDate(p.created_at)}<br /><span className="font-mono text-gray-400">{p.id.slice(0, 8).toUpperCase()}</span></td>
                <td className="px-5 py-3 text-xs">{p.user?.first_name} {p.user?.last_name}<br /><span className="text-gray-500">{p.user?.email}</span></td>
                <td className="px-5 py-3"><p className="font-medium">{PAYMENT_PURPOSE_LABELS[p.purpose]}</p><p className="max-w-[16rem] truncate text-xs text-gray-500">{p.description}</p></td>
                <td className="px-5 py-3 text-xs">{PAYMENT_PROVIDER_LABELS[p.provider]}{p.provider_reference && <span className="block font-mono text-gray-400">{p.provider_reference}</span>}</td>
                <td className="whitespace-nowrap px-5 py-3 font-semibold tabular-nums">{formatPrice(p.amount, p.currency)}</td>
                <td className="px-5 py-3"><StatusBadge status={p.status} label={PAYMENT_STATUS_LABELS[p.status]} />
                  {p.failure_reason && <span className="mt-1 block text-xs text-gray-400">{p.failure_reason}</span>}</td>
                <td className="px-5 py-3">
                  {(p.status === 'pending' || p.status === 'failed') && (
                    <Button size="sm" icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => setAction({ kind: 'confirm', payment: p })}>Confirmer</Button>
                  )}
                  {p.status === 'succeeded' && p.amount > 0 && (
                    <Button size="sm" variant="ghost" icon={<Undo2 className="h-4 w-4" />} onClick={() => setAction({ kind: 'refund', payment: p })}>Rembourser</Button>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
      <ConfirmDialog
        isOpen={!!action}
        title={action?.kind === 'refund' ? 'Rembourser ce paiement' : 'Confirmer la réception du paiement'}
        description={action && (
          <>
            {formatPrice(action.payment.amount, action.payment.currency)} — {action.payment.description}.<br />
            {action.kind === 'refund'
              ? 'L’avantage associé (abonnement ou promotion) sera retiré. Le remboursement des fonds se fait auprès du prestataire.'
              : 'Ne confirmez qu’après avoir vérifié la réception effective des fonds. L’avantage sera activé immédiatement.'}
          </>
        )}
        inputLabel={action?.kind === 'refund' ? 'Motif du remboursement' : 'Référence du reçu / virement / transaction'}
        tone={action?.kind === 'refund' ? 'danger' : 'primary'}
        confirmLabel={action?.kind === 'refund' ? 'Rembourser' : 'Confirmer le paiement'}
        isLoading={mutation.isPending}
        error={mutation.isError ? errorMessage(mutation.error) : null}
        onClose={() => setAction(null)}
        onConfirm={(value) => {
          if (!action) return;
          const done = { onSuccess: () => setAction(null) };
          if (action.kind === 'refund') refund.mutate({ id: action.payment.id, reason: value }, done);
          else confirm.mutate({ id: action.payment.id, reference: value }, done);
        }}
      />
    </div>
  );
}
