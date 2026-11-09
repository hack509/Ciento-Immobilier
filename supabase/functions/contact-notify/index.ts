// E-mail alert to the administration for each new contact message.
// Triggered by a Supabase Database Webhook (INSERT on public.contact_messages)
// sending the header  x-webhook-secret: <CONTACT_WEBHOOK_SECRET>.
// Without an e-mail provider the message stays in the dashboard inbox only.
import { createProvider, readEmailConfig } from '../_shared/email.ts';
import { escapeHtml } from '../_shared/newsletter-render.ts';

const env = Deno.env.toObject();
const SOURCES: Record<string, string> = {
  contact_page: 'Page contact', property: 'Annonce', agency: 'Page agence', service: 'Service immobilier', other: 'Autre',
};

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!env.CONTACT_WEBHOOK_SECRET || request.headers.get('x-webhook-secret') !== env.CONTACT_WEBHOOK_SECRET) {
    return new Response('Forbidden', { status: 403 });
  }
  const payload = await request.json() as { type?: string; table?: string; record?: Record<string, string | null> };
  const record = payload.record;
  if (payload.type !== 'INSERT' || payload.table !== 'contact_messages' || !record) return new Response('ignored');
  // Listing inquiries go to the owner; only messages addressed to the platform alert admins.
  if (record.source === 'property') return new Response('skipped');

  const config = readEmailConfig(env);
  const to = env.ADMIN_NOTIFICATION_EMAIL;
  if (!config || !to) return new Response(JSON.stringify({ skipped: 'no_email_provider' }), { status: 200 });

  const site = env.SITE_URL || 'https://ciento-immobilier.com';
  const link = `${site}/admin/messages?id=${encodeURIComponent(record.id ?? '')}`;
  const html = `<div style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.5">
    <h2 style="color:#1D3E91;margin:0 0 12px">Nouveau message — ${escapeHtml(SOURCES[record.source ?? 'other'] ?? 'Site')}</h2>
    <p><strong>${escapeHtml(record.full_name ?? '')}</strong> &lt;${escapeHtml(record.email ?? '')}&gt;${record.phone ? ` · ${escapeHtml(record.phone)}` : ''}</p>
    <p><strong>Objet :</strong> ${escapeHtml(record.subject ?? '')}</p>
    <p style="white-space:pre-line;background:#f3f6fb;padding:12px;border-radius:8px">${escapeHtml((record.message ?? '').slice(0, 2000))}</p>
    <p><a href="${escapeHtml(link)}" style="display:inline-block;background:#1D3E91;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Ouvrir dans le tableau de bord</a></p>
  </div>`;
  const [result] = await createProvider(config).sendBatch([{
    to, subject: `[Contact] ${(record.subject ?? '').slice(0, 120)}`, html, replyTo: record.email ?? undefined,
  }]);
  if (!result.ok) console.error('contact_notify_failed', result.error);
  return new Response(JSON.stringify({ sent: result.ok }), { status: 200 });
});
