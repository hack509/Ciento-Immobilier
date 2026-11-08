// Payments Edge Function — the ONLY component allowed to confirm a payment.
//
// POST { action: 'start',  payment_id }  → redirect URL (MonCash), manual
//                                           instructions, or immediate confirmation
//                                           in development simulation mode.
// POST { action: 'verify', payment_id }  → asks the provider server-side and
//                                           confirms the payment when it is paid.
//
// A browser redirect is never a proof of payment: the return page calls
// 'verify', which queries MonCash with the merchant credentials.
//
// Environment (supabase secrets set ...):
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (provided by Supabase)
//   APP_ENV=production|staging|development
//   PAYMENTS_MODE=live|simulation           (simulation refused when APP_ENV=production)
//   MONCASH_CLIENT_ID, MONCASH_CLIENT_SECRET, MONCASH_MODE=sandbox|live
//   PAYMENT_MANUAL_INSTRUCTIONS             (bank transfer / cash instructions shown to payers)
//   ALLOWED_ORIGINS                         (comma separated, e.g. https://ciento-immobilier.com)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import {
  MonCashClient,
  isSimulationAllowed,
  readMonCashConfig,
  type PaymentRecord,
} from '../_shared/payment-providers.ts';

const env = Deno.env.toObject();
const allowedOrigins = (env.ALLOWED_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean);

function corsHeaders(origin: string | null): Record<string, string> {
  const allowOrigin = origin && (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) ? origin : allowedOrigins[0] ?? '*';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (request: Request) => {
  const origin = request.headers.get('origin');
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (request.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405, origin);

  const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Service de paiement indisponible.' }, 503, origin);
  }

  const authorization = request.headers.get('authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) return json({ error: 'Authentification requise.' }, 401, origin);

  let body: { action?: unknown; payment_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Corps JSON invalide.' }, 400, origin);
  }
  if (typeof body.payment_id !== 'string' || !UUID_RE.test(body.payment_id)) {
    return json({ error: 'Transaction invalide.' }, 400, origin);
  }
  if (body.action !== 'start' && body.action !== 'verify') {
    return json({ error: 'Action inconnue.' }, 400, origin);
  }

  // The user's own client: RLS decides whether the caller may see this payment.
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: payment, error } = await userClient
    .from('payments')
    .select('id, amount, currency, provider, status, expires_at')
    .eq('id', body.payment_id)
    .maybeSingle();
  if (error || !payment) return json({ error: 'Transaction introuvable.' }, 404, origin);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const record: PaymentRecord = { ...payment, amount: Number(payment.amount) };

  if (payment.status === 'succeeded') return json({ status: 'succeeded' }, 200, origin);
  if (payment.status !== 'pending' && !(body.action === 'verify' && payment.status === 'failed')) {
    return json({ status: payment.status }, 200, origin);
  }

  try {
    // ---------------- Simulation (development only) ----------------
    if (payment.provider === 'simulated') {
      if (!isSimulationAllowed(env)) {
        return json({ error: 'Le paiement simulé est désactivé sur cet environnement.' }, 403, origin);
      }
      if (body.action === 'start') {
        const { error: confirmError } = await admin.rpc('confirm_payment', {
          p_payment_id: payment.id,
          p_provider_reference: `SIM-${crypto.randomUUID()}`,
          p_paid_amount: record.amount,
          p_payload: { simulated: true, env: env.APP_ENV ?? 'unknown' },
        });
        if (confirmError) throw confirmError;
        return json({ status: 'succeeded', simulated: true }, 200, origin);
      }
      return json({ status: payment.status }, 200, origin);
    }

    // ---------------- Manual (bank transfer / cash, confirmed by an admin) ----------------
    if (payment.provider === 'manual') {
      return json({
        status: 'pending',
        instructions: env.PAYMENT_MANUAL_INSTRUCTIONS ??
          'Contactez notre équipe pour finaliser le paiement. Indiquez la référence de transaction.',
        reference: payment.id,
      }, 200, origin);
    }

    // ---------------- MonCash ----------------
    if (payment.provider === 'moncash') {
      const config = readMonCashConfig(env);
      if (!config) return json({ error: 'MonCash n\'est pas encore configuré.' }, 503, origin);
      if (config.mode === 'sandbox' && env.APP_ENV === 'production') {
        return json({ error: 'Configuration MonCash invalide.' }, 503, origin);
      }
      const moncash = new MonCashClient(config);

      if (body.action === 'start') {
        if (new Date(payment.expires_at).getTime() < Date.now()) {
          return json({ error: 'Cette transaction a expiré. Recommencez le paiement.' }, 410, origin);
        }
        const redirectUrl = await moncash.createPayment(record);
        return json({ status: 'pending', redirect_url: redirectUrl }, 200, origin);
      }

      const result = await moncash.verifyOrder(record);
      if (result.status === 'succeeded') {
        const { data, error: confirmError } = await admin.rpc('confirm_payment', {
          p_payment_id: payment.id,
          p_provider_reference: result.reference,
          p_paid_amount: result.paidAmount,
          p_payload: result.payload,
        });
        if (confirmError) throw confirmError;
        return json({ status: (data as { status?: string } | null)?.status ?? 'succeeded' }, 200, origin);
      }
      if (result.status === 'failed') {
        await admin.rpc('fail_payment', { p_payment_id: payment.id, p_reason: result.reason ?? 'failed', p_payload: result.payload });
      }
      return json({ status: result.status }, 200, origin);
    }

    // ---------------- Card (provider to be contracted) ----------------
    return json({ error: 'Le paiement par carte n\'est pas encore disponible.' }, 501, origin);
  } catch (err) {
    console.error('payment_error', payment.id, err instanceof Error ? err.message : err);
    return json({ error: 'Le prestataire de paiement est indisponible. Réessayez plus tard.' }, 502, origin);
  }
});
