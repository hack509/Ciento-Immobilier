import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock, XCircle, Smartphone, Landmark, FlaskConical, ShieldCheck } from 'lucide-react';
import { PageHeader, Panel } from '@/components/dashboard/DashboardUI';
import { StatusBadge } from '@/components/billing/BillingUI';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { usePayment, useSubscriptionActions } from '@/hooks/useBilling';
import { PAYMENT_PROVIDER_LABELS, PAYMENT_PURPOSE_LABELS, PAYMENT_STATUS_LABELS, errorMessage } from '@/lib/monetization';
import { formatDate, formatPrice } from '@/lib/utils';

const PENDING_KEY = 'ciento-pending-payment';

/**
 * Payment page. The browser never decides that a payment succeeded:
 * it asks the payments Edge Function, which verifies with the provider.
 * MonCash return URL to configure: <APP_URL>/dashboard/paiement/retour
 */
export function Checkout() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const paymentId = id === 'retour' ? sessionStorageGet(PENDING_KEY) ?? undefined : id;
  const { data: payment, isLoading, refetch } = usePayment(paymentId);
  const actions = useSubscriptionActions();
  const [instructions, setInstructions] = useState<string | null>(null);
  const verifiedOnce = useRef(false);

  // Back from the provider: verify server-side once.
  const shouldVerify = id === 'retour' || params.get('verifier') === '1';
  useEffect(() => {
    if (!shouldVerify || !payment || payment.status !== 'pending' || verifiedOnce.current) return;
    verifiedOnce.current = true;
    actions.callProvider.mutate({ action: 'verify', paymentId: payment.id }, { onSettled: () => refetch() });
  }, [shouldVerify, payment, actions.callProvider, refetch]);

  const start = () => {
    if (!payment) return;
    sessionStorageSet(PENDING_KEY, payment.id);
    actions.callProvider.mutate({ action: 'start', paymentId: payment.id }, {
      onSuccess: (result) => {
        if (result.redirect_url) {
          window.location.assign(result.redirect_url);
          return;
        }
        if (result.instructions) setInstructions(result.instructions);
        refetch();
      },
    });
  };

  if (isLoading) return <LoadingSpinner className="py-24" text="Chargement de la transaction…" />;
  if (!payment) {
    return (
      <Panel><div className="p-10 text-center">
        <p className="font-semibold text-primary-900">Transaction introuvable.</p>
        <Link to="/dashboard/paiements" className="mt-4 inline-block"><Button variant="outline">Mes paiements</Button></Link>
      </div></Panel>
    );
  }

  const expired = payment.status === 'pending' && new Date(payment.expires_at) < new Date();
  const ProviderIcon = payment.provider === 'moncash' ? Smartphone : payment.provider === 'simulated' ? FlaskConical : Landmark;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Paiement" subtitle={`Référence ${payment.id.slice(0, 8).toUpperCase()}`} />
      <Panel>
        <div className="space-y-6 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-gray-500">{PAYMENT_PURPOSE_LABELS[payment.purpose]}</p>
              <p className="font-semibold text-primary-900">{payment.description}</p>
            </div>
            <StatusBadge status={payment.status} label={PAYMENT_STATUS_LABELS[payment.status]} />
          </div>
          <p className="font-display text-4xl font-extrabold text-primary-900">{formatPrice(payment.amount, payment.currency)}</p>
          <p className="flex items-center gap-2 text-sm text-gray-600"><ProviderIcon className="h-4 w-4" />{PAYMENT_PROVIDER_LABELS[payment.provider]}</p>

          {payment.status === 'succeeded' && (
            <div role="status" className="flex gap-3 rounded-xl bg-success-50 p-4 text-sm text-success-700">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Paiement confirmé{payment.confirmed_at ? ` le ${formatDate(payment.confirmed_at)}` : ''}.</p>
                <p>Votre service est activé. La facture est disponible dans vos paiements.</p>
              </div>
            </div>
          )}
          {(payment.status === 'failed' || payment.status === 'cancelled' || expired) && (
            <div role="alert" className="flex gap-3 rounded-xl bg-danger-50 p-4 text-sm text-danger-600">
              <XCircle className="h-5 w-5 shrink-0" />
              <p>{expired ? 'Cette transaction a expiré.' : payment.status === 'failed' ? 'Le paiement n’a pas abouti.' : 'Transaction annulée.'} Vous pouvez recommencer depuis la page concernée.</p>
            </div>
          )}
          {instructions && (
            <div className="rounded-xl bg-primary-50 p-4 text-sm text-primary-900">
              <p className="mb-1 font-semibold">Instructions de paiement</p>
              <p className="whitespace-pre-line">{instructions}</p>
              <p className="mt-2 text-xs">Indiquez la référence <strong>{payment.id.slice(0, 8).toUpperCase()}</strong>. L’activation intervient après vérification par notre équipe.</p>
            </div>
          )}
          {actions.callProvider.isError && (
            <p role="alert" className="rounded-lg bg-danger-50 p-3 text-sm text-danger-600">{errorMessage(actions.callProvider.error)}</p>
          )}

          {payment.status === 'pending' && !expired && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="flex-1" onClick={start} isLoading={actions.callProvider.isPending}>
                {payment.provider === 'moncash' ? 'Payer avec MonCash' : payment.provider === 'simulated' ? 'Simuler le paiement' : 'Afficher les instructions'}
              </Button>
              {payment.provider === 'moncash' && (
                <Button variant="outline" icon={<Clock className="h-4 w-4" />} isLoading={actions.callProvider.isPending}
                  onClick={() => actions.callProvider.mutate({ action: 'verify', paymentId: payment.id }, { onSettled: () => refetch() })}>
                  J’ai payé, vérifier
                </Button>
              )}
              <Button variant="ghost" isLoading={actions.cancelPayment.isPending}
                onClick={() => actions.cancelPayment.mutate(payment.id, { onSuccess: () => refetch() })}>
                Abandonner
              </Button>
            </div>
          )}

          <p className="flex items-center gap-2 border-t border-gray-100 pt-4 text-xs text-gray-500">
            <ShieldCheck className="h-4 w-4 text-success-600" />
            Montant calculé par nos serveurs. Le paiement est vérifié directement auprès du prestataire avant toute activation.
          </p>
        </div>
      </Panel>
      <p className="mt-4 text-center text-sm"><Link to="/dashboard/paiements" className="text-brand-blue hover:underline">Voir tous mes paiements</Link></p>
    </div>
  );
}

function sessionStorageGet(key: string): string | null {
  try { return sessionStorage.getItem(key); } catch { return null; }
}
function sessionStorageSet(key: string, value: string) {
  try { sessionStorage.setItem(key, value); } catch { /* storage unavailable */ }
}
