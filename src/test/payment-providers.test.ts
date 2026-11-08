import { describe, expect, it, vi } from 'vitest';
import {
  MonCashClient, evaluateMonCashOrder, isSimulationAllowed, readMonCashConfig, type PaymentRecord,
} from '../../supabase/functions/_shared/payment-providers';

const payment: PaymentRecord = { id: '0b5f6c1e-1111-4a3b-9c8d-123456789abc', amount: 2500, currency: 'HTG', provider: 'moncash', status: 'pending' };

describe('simulation guard', () => {
  it('is refused in production even when the flag is set', () => {
    expect(isSimulationAllowed({ PAYMENTS_MODE: 'simulation', APP_ENV: 'production' })).toBe(false);
    expect(isSimulationAllowed({ PAYMENTS_MODE: 'simulation' })).toBe(false); // missing env = production
    expect(isSimulationAllowed({ PAYMENTS_MODE: 'live', APP_ENV: 'development' })).toBe(false);
    expect(isSimulationAllowed({ PAYMENTS_MODE: 'simulation', APP_ENV: 'development' })).toBe(true);
  });
});

describe('MonCash verification (server-side proof of payment)', () => {
  it('accepts a successful order with the full amount', () => {
    const r = evaluateMonCashOrder(payment, {
      status: 200, payment: { reference: payment.id, transaction_id: 'TX-1', cost: 2500, message: 'successful', payer: '50937000000' },
    });
    expect(r).toMatchObject({ status: 'succeeded', reference: 'TX-1', paidAmount: 2500 });
    expect(JSON.stringify(r.payload)).not.toContain('50937000000'); // payer phone is masked
  });

  it('rejects an underpaid order', () => {
    const r = evaluateMonCashOrder(payment, { payment: { reference: payment.id, transaction_id: 'TX-2', cost: '100', message: 'successful' } });
    expect(r.status).toBe('failed');
    expect(r.reason).toBe('amount_mismatch');
  });

  it('rejects a transaction that belongs to another order (replay)', () => {
    const r = evaluateMonCashOrder(payment, { payment: { reference: 'other-order', transaction_id: 'TX-3', cost: 2500, message: 'successful' } });
    expect(r.status).toBe('failed');
    expect(r.reason).toBe('order_mismatch');
  });

  it('keeps a not-yet-paid order pending', () => {
    expect(evaluateMonCashOrder(payment, { payment: { reference: payment.id, message: 'pending' } }).status).toBe('pending');
    expect(evaluateMonCashOrder(payment, {}).status).toBe('pending');
  });
});

describe('MonCash client', () => {
  const config = { clientId: 'id', clientSecret: 'secret', mode: 'sandbox' as const };
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  it('reads credentials from the environment only', () => {
    expect(readMonCashConfig({})).toBeNull();
    expect(readMonCashConfig({ MONCASH_CLIENT_ID: 'a', MONCASH_CLIENT_SECRET: 'b' })).toEqual({ clientId: 'a', clientSecret: 'b', mode: 'sandbox' });
    expect(readMonCashConfig({ MONCASH_CLIENT_ID: 'a', MONCASH_CLIENT_SECRET: 'b', MONCASH_MODE: 'live' })?.mode).toBe('live');
  });

  it('creates a payment with our payment id as orderId and returns the gateway URL', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ access_token: 'tok' }))
      .mockResolvedValueOnce(json({ payment_token: { token: 'pay-token' } }));
    const url = await new MonCashClient(config, fetchMock).createPayment(payment);
    expect(url).toBe('https://sandbox.moncashbutton.digicelgroup.com/Moncash-middleware/Payment/Redirect?token=pay-token');
    const body = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body).toEqual({ amount: 2500, orderId: payment.id });
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer tok');
  });

  it('refuses non-HTG amounts (MonCash only supports HTG)', async () => {
    await expect(new MonCashClient(config, vi.fn()).createPayment({ ...payment, currency: 'USD' })).rejects.toThrow('moncash_requires_htg');
  });

  it('treats an unknown order as still pending', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ access_token: 'tok' }))
      .mockResolvedValueOnce(new Response('', { status: 404 }));
    expect((await new MonCashClient(config, fetchMock).verifyOrder(payment)).status).toBe('pending');
  });

  it('fails loudly when authentication fails', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response('', { status: 401 }));
    await expect(new MonCashClient(config, fetchMock).verifyOrder(payment)).rejects.toThrow('moncash_auth_failed_401');
  });
});
