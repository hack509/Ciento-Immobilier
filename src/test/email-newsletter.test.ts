import { describe, expect, it, vi } from 'vitest';
import {
  BrevoProvider, ResendProvider, mapBrevoEvent, mapResendEvent, readEmailConfig, unsubscribeHeaders, verifySvixSignature,
} from '../../supabase/functions/_shared/email';
import { renderNewsletterBody, renderNewsletterHtml, renderNewsletterText } from '../../supabase/functions/_shared/newsletter-render';
import { buildReplyMailto } from '@/services/inbox.service';

describe('newsletter rendering (admin content is always escaped)', () => {
  it('supports the safe Markdown subset', () => {
    const html = renderNewsletterBody('# Titre\n\n**Gras** et *italique*\n\n- un\n- deux\n\n[Voir](https://ciento.test/annonces)');
    expect(html).toContain('<h1');
    expect(html).toContain('<strong>Gras</strong>');
    expect(html).toContain('<em>italique</em>');
    expect(html).toContain('<li style="margin:4px 0">un</li>');
    expect(html).toContain('<a href="https://ciento.test/annonces"');
  });

  it('cannot inject markup, scripts or unsafe links', () => {
    const html = renderNewsletterBody('<script>alert(1)</script> <img src=x onerror=alert(1)>\n\n[clic](javascript:alert(1))\n\n[x](https://a.test" onclick="alert(1))');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
    expect(html).not.toMatch(/href="javascript/);
    expect(html).not.toMatch(/onclick="/);
    expect(html).toContain('&lt;script&gt;');
  });

  it('always includes the unsubscribe link and a text version', () => {
    const email = { subject: 'Nouveautés', content: 'Bonjour **à tous**', unsubscribeUrl: 'https://x.supabase.co/functions/v1/newsletter-manage?token=abc', siteUrl: 'https://ciento.test' };
    expect(renderNewsletterHtml(email)).toContain('newsletter-manage?token=abc');
    expect(renderNewsletterHtml(email)).toContain('#1D3E91');
    expect(renderNewsletterText(email)).toContain('Se désinscrire : https://x.supabase.co/functions/v1/newsletter-manage?token=abc');
    expect(renderNewsletterText(email)).not.toContain('**');
  });
});

describe('email providers', () => {
  it('never pretends a provider exists', () => {
    expect(readEmailConfig({})).toBeNull();
    expect(readEmailConfig({ RESEND_API_KEY: 're_x' })).toBeNull(); // no sender address
    expect(readEmailConfig({ RESEND_API_KEY: 're_x', EMAIL_FROM: 'news@ciento.ht' })).toMatchObject({ provider: 'resend' });
    expect(readEmailConfig({ BREVO_API_KEY: 'b', EMAIL_FROM: 'news@ciento.ht' })).toMatchObject({ provider: 'brevo' });
    expect(readEmailConfig({ EMAIL_PROVIDER: 'brevo', RESEND_API_KEY: 're', EMAIL_FROM: 'a@b.ht' })).toBeNull();
  });

  const config = { provider: 'resend' as const, apiKey: 'key', from: 'news@ciento.ht', fromName: 'CIENTO-IMMOBILIER' };
  const email = { to: 'a@b.ht', subject: 'S', html: '<p>x</p>', headers: unsubscribeHeaders('https://u.test/x') };

  it('Resend: batch send maps message ids', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ id: 'm1' }, { id: 'm2' }] }), { status: 200 }));
    const results = await new ResendProvider(config, fetchMock).sendBatch([email, { ...email, to: 'c@d.ht' }]);
    expect(results).toEqual([{ ok: true, messageId: 'm1' }, { ok: true, messageId: 'm2' }]);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body[0]).toMatchObject({ from: 'CIENTO-IMMOBILIER <news@ciento.ht>', to: ['a@b.ht'] });
    expect(body[0].headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
  });

  it('Resend: a refused batch is reported as failed, not sent', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 422 }));
    expect(await new ResendProvider(config, fetchMock).sendBatch([email])).toEqual([{ ok: false, error: 'resend_422' }]);
  });

  it('Brevo: one call per recipient', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ messageId: '<b1>' }), { status: 201 }))
      .mockResolvedValueOnce(new Response('{}', { status: 400 }));
    const results = await new BrevoProvider({ ...config, provider: 'brevo' }, fetchMock).sendBatch([email, email]);
    expect(results).toEqual([{ ok: true, messageId: '<b1>' }, { ok: false, error: 'brevo_400' }]);
  });

  it('maps provider events', () => {
    expect(mapResendEvent('email.delivered')).toBe('delivered');
    expect(mapResendEvent('email.bounced')).toBe('bounced');
    expect(mapResendEvent('email.sent')).toBeNull();
    expect(mapBrevoEvent('hard_bounce')).toBe('bounced');
    expect(mapBrevoEvent('click')).toBe('clicked');
  });
});

describe('webhook signatures (Svix / Resend)', () => {
  const secretBytes = new TextEncoder().encode('super-secret-key-for-tests-123456');
  const secret = `whsec_${btoa(String.fromCharCode(...secretBytes))}`;

  async function sign(id: string, ts: string, body: string) {
    const key = await crypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${ts}.${body}`));
    return `v1,${btoa(String.fromCharCode(...new Uint8Array(mac)))}`;
  }

  it('accepts a valid signature', async () => {
    const now = 1_800_000_000;
    const body = '{"type":"email.delivered"}';
    const signature = await sign('msg_1', String(now), body);
    expect(await verifySvixSignature(secret, { id: 'msg_1', timestamp: String(now), signature }, body, now)).toBe(true);
  });

  it('rejects tampered bodies, missing headers and replays', async () => {
    const now = 1_800_000_000;
    const signature = await sign('msg_1', String(now), '{"a":1}');
    expect(await verifySvixSignature(secret, { id: 'msg_1', timestamp: String(now), signature }, '{"a":2}', now)).toBe(false);
    expect(await verifySvixSignature(secret, { id: null, timestamp: String(now), signature }, '{"a":1}', now)).toBe(false);
    expect(await verifySvixSignature(secret, { id: 'msg_1', timestamp: String(now), signature }, '{"a":1}', now + 3600)).toBe(false);
  });
});

describe('reply by e-mail', () => {
  it('prefills address, subject and quoted message without marking anything as sent', () => {
    const link = buildReplyMailto({ email: 'paul@x.ht', subject: 'Visite', full_name: 'Paul', message: 'Bonjour\nMerci', created_at: '2026-11-08T10:00:00Z' });
    expect(link.startsWith('mailto:paul%40x.ht?subject=Re%3A%20Visite')).toBe(true);
    expect(decodeURIComponent(link)).toContain('> Bonjour');
    expect(buildReplyMailto({ email: 'a@b.ht', subject: 'RE: déjà', full_name: 'A', message: 'x', created_at: '2026-11-08T10:00:00Z' }))
      .toContain('subject=RE%3A%20d%C3%A9j%C3%A0');
  });
});
