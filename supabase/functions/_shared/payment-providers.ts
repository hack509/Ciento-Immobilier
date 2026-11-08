// Payment provider adapters. Pure TypeScript (no Deno globals) so the logic is
// unit-tested with Vitest (src/test/payment-providers.test.ts).
//
// MonCash (Digicel) REST API — based on the official "RestAPI MonCash" document
// (sandbox.moncashbutton.digicelgroup.com/Moncash-business/resources/doc/RestAPI_MonCash_doc.pdf).
// That document dates from 2019: endpoints, token lifetime and the return-URL
// parameters MUST be re-validated with Digicel when the merchant account is opened.

export interface PaymentRecord {
  id: string;
  amount: number;
  currency: string;
  provider: string;
  status: string;
}

export interface VerificationResult {
  status: 'succeeded' | 'pending' | 'failed';
  reference: string | null;
  paidAmount: number | null;
  reason?: string;
  payload: Record<string, unknown>;
}

export interface MonCashConfig {
  clientId: string;
  clientSecret: string;
  mode: 'sandbox' | 'live';
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export const MONCASH_HOSTS = {
  sandbox: 'https://sandbox.moncashbutton.digicelgroup.com',
  live: 'https://moncashbutton.digicelgroup.com',
} as const;

/** Simulation is a development tool only: it needs an explicit flag AND a non-production environment. */
export function isSimulationAllowed(env: { PAYMENTS_MODE?: string; APP_ENV?: string }): boolean {
  return env.PAYMENTS_MODE === 'simulation' && (env.APP_ENV ?? 'production') !== 'production';
}

export function readMonCashConfig(env: Record<string, string | undefined>): MonCashConfig | null {
  const clientId = env.MONCASH_CLIENT_ID;
  const clientSecret = env.MONCASH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, mode: env.MONCASH_MODE === 'live' ? 'live' : 'sandbox' };
}

function toBase64(value: string): string {
  // btoa exists in Deno, browsers and Node >= 16.
  return btoa(value);
}

export class MonCashClient {
  private readonly host: string;
  private readonly config: MonCashConfig;
  private readonly fetchImpl: Fetch;

  constructor(config: MonCashConfig, fetchImpl: Fetch = (input, init) => fetch(input, init)) {
    this.config = config;
    this.fetchImpl = fetchImpl;
    this.host = MONCASH_HOSTS[config.mode];
  }

  async getAccessToken(): Promise<string> {
    const response = await this.fetchImpl(`${this.host}/Api/oauth/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${toBase64(`${this.config.clientId}:${this.config.clientSecret}`)}`,
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'scope=read,write&grant_type=client_credentials',
    });
    if (!response.ok) throw new Error(`moncash_auth_failed_${response.status}`);
    const body = (await response.json()) as { access_token?: string };
    if (!body.access_token) throw new Error('moncash_auth_no_token');
    return body.access_token;
  }

  /** Creates the MonCash order (orderId = our payment id) and returns the redirect URL. */
  async createPayment(payment: PaymentRecord): Promise<string> {
    if (payment.currency !== 'HTG') throw new Error('moncash_requires_htg');
    const token = await this.getAccessToken();
    const response = await this.fetchImpl(`${this.host}/Api/v1/CreatePayment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: payment.amount, orderId: payment.id }),
    });
    if (!response.ok) throw new Error(`moncash_create_failed_${response.status}`);
    const body = (await response.json()) as { payment_token?: { token?: string } };
    const paymentToken = body.payment_token?.token;
    if (!paymentToken) throw new Error('moncash_create_no_token');
    return `${this.host}/Moncash-middleware/Payment/Redirect?token=${encodeURIComponent(paymentToken)}`;
  }

  /** Server-side verification: the only source of truth for a MonCash payment. */
  async verifyOrder(payment: PaymentRecord): Promise<VerificationResult> {
    const token = await this.getAccessToken();
    const response = await this.fetchImpl(`${this.host}/Api/v1/RetrieveOrderPayment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: payment.id }),
    });
    if (response.status === 404) {
      return { status: 'pending', reference: null, paidAmount: null, reason: 'not_found', payload: {} };
    }
    if (!response.ok) throw new Error(`moncash_verify_failed_${response.status}`);
    return evaluateMonCashOrder(payment, (await response.json()) as MonCashOrderResponse);
  }
}

export interface MonCashOrderResponse {
  status?: number;
  payment?: {
    reference?: string | number;
    transaction_id?: string | number;
    cost?: number | string;
    message?: string;
    payer?: string;
  };
}

/** Maps a RetrieveOrderPayment answer to our status, checking reference and amount. */
export function evaluateMonCashOrder(payment: PaymentRecord, body: MonCashOrderResponse): VerificationResult {
  const p = body.payment;
  const payload = { status: body.status, payment: p ? { ...p, payer: p.payer ? 'masked' : undefined } : null };
  if (!p) return { status: 'pending', reference: null, paidAmount: null, reason: 'no_payment', payload };

  const reference = p.reference !== undefined ? String(p.reference) : null;
  if (reference !== null && reference !== payment.id) {
    return { status: 'failed', reference: null, paidAmount: null, reason: 'order_mismatch', payload };
  }

  const transactionId = p.transaction_id !== undefined ? String(p.transaction_id) : null;
  const paidAmount = p.cost !== undefined ? Number(p.cost) : null;
  const successful = (p.message ?? '').toLowerCase() === 'successful';

  if (!successful || !transactionId) {
    return { status: 'pending', reference: transactionId, paidAmount, reason: p.message ?? 'not_successful', payload };
  }
  if (paidAmount === null || Number.isNaN(paidAmount) || paidAmount < payment.amount) {
    // The database also rejects underpayments; reported here for clarity.
    return { status: 'failed', reference: transactionId, paidAmount, reason: 'amount_mismatch', payload };
  }
  return { status: 'succeeded', reference: transactionId, paidAmount, payload };
}
