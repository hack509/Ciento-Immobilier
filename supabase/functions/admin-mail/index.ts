// Admin e-mail Edge Function: newsletter campaigns and replies to contact messages.
// Nothing is reported as "sent" unless the provider accepted the message.
//
// POST { action: 'status' }                                → provider configured?
// POST { action: 'send_campaign', campaign_id }            → sends one time-boxed batch;
//                                                             call again while remaining > 0
// POST { action: 'test_campaign', campaign_id }            → test e-mail to the admin only
// POST { action: 'reply_contact', message_id, subject, body }
//
// Env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ALLOWED_ORIGINS, SITE_URL,
//      EMAIL_PROVIDER (resend|brevo), RESEND_API_KEY | BREVO_API_KEY, EMAIL_FROM, EMAIL_FROM_NAME, EMAIL_REPLY_TO
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { createProvider, readEmailConfig, unsubscribeHeaders } from '../_shared/email.ts';
import { escapeHtml, renderNewsletterHtml, renderNewsletterText } from '../_shared/newsletter-render.ts';
import { corsHeaders, json, parseOrigins, UUID_RE } from '../_shared/http.ts';

const env = Deno.env.toObject();
const origins = parseOrigins(env.ALLOWED_ORIGINS);
const TIME_BUDGET_MS = 45_000;

Deno.serve(async (request: Request) => {
  const cors = corsHeaders(request.headers.get('origin'), origins);
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405, cors);

  const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'Service indisponible.' }, 503, cors);

  const user = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: request.headers.get('authorization') ?? '' } }, auth: { persistSession: false },
  });
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const { data: auth } = await user.auth.getUser();
  const { data: isAdmin } = await user.rpc('is_admin');
  if (!auth?.user || isAdmin !== true) return json({ error: 'Accès refusé.' }, 403, cors);

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return json({ error: 'Corps JSON invalide.' }, 400, cors); }

  const config = readEmailConfig(env);
  if (body.action === 'status') return json({ configured: !!config, provider: config?.provider ?? null }, 200, cors);
  if (!config) {
    return json({ error: 'Aucun fournisseur d’e-mail n’est configuré : rien n’a été envoyé.', configured: false }, 503, cors);
  }
  const provider = createProvider(config);
  const siteUrl = env.SITE_URL || 'https://ciento-immobilier.com';
  const unsubscribeBase = `${SUPABASE_URL}/functions/v1/newsletter-manage?token=`;

  try {
    // ---------------------------------------------------------- campaigns
    if (body.action === 'send_campaign' || body.action === 'test_campaign') {
      const campaignId = String(body.campaign_id ?? '');
      if (!UUID_RE.test(campaignId)) return json({ error: 'Campagne invalide.' }, 400, cors);
      const { data: campaign } = await user.from('newsletter_campaigns').select('*').eq('id', campaignId).maybeSingle();
      if (!campaign) return json({ error: 'Campagne introuvable.' }, 404, cors);

      if (body.action === 'test_campaign') {
        const unsubscribeUrl = `${siteUrl}/newsletter/test`;
        const [result] = await provider.sendBatch([{
          to: auth.user.email!,
          subject: `[TEST] ${campaign.subject}`,
          html: renderNewsletterHtml({ ...campaign, unsubscribeUrl, siteUrl }),
          text: renderNewsletterText({ ...campaign, unsubscribeUrl, siteUrl }),
        }]);
        return result.ok ? json({ ok: true, to: auth.user.email }, 200, cors) : json({ error: `Échec de l’envoi (${result.error}).` }, 502, cors);
      }

      if (campaign.status === 'draft') {
        const { error } = await user.rpc('admin_start_newsletter_campaign', { p_campaign_id: campaignId, p_provider: provider.name });
        if (error) return json({ error: error.message }, 409, cors);
      } else if (campaign.status !== 'sending') {
        return json({ error: 'Cette campagne a déjà été traitée.' }, 409, cors);
      }

      const started = Date.now();
      let summary: { remaining: number; sent: number; failed: number } = { remaining: 0, sent: 0, failed: 0 };
      while (Date.now() - started < TIME_BUDGET_MS) {
        const { data: batch, error } = await admin.rpc('claim_newsletter_batch', { p_campaign_id: campaignId, p_limit: 100 });
        if (error) throw error;
        const rows = (batch ?? []) as { log_id: number; email: string; unsubscribe_token: string }[];
        const results = rows.length === 0 ? [] : await provider.sendBatch(rows.map((r) => {
          const unsubscribeUrl = unsubscribeBase + r.unsubscribe_token;
          return {
            to: r.email,
            subject: campaign.subject,
            html: renderNewsletterHtml({ ...campaign, unsubscribeUrl, siteUrl }),
            text: renderNewsletterText({ ...campaign, unsubscribeUrl, siteUrl }),
            headers: unsubscribeHeaders(unsubscribeUrl),
          };
        }));
        const { data: recorded, error: recordError } = await admin.rpc('record_newsletter_batch', {
          p_campaign_id: campaignId,
          p_results: rows.map((r, i) => ({ log_id: r.log_id, ok: results[i]?.ok ?? false, message_id: results[i]?.messageId ?? null, error: results[i]?.error ?? null })),
        });
        if (recordError) throw recordError;
        summary = recorded as typeof summary;
        if (summary.remaining === 0 || rows.length === 0) break;
      }
      return json(summary, 200, cors);
    }

    // ---------------------------------------------------------- contact replies
    if (body.action === 'reply_contact') {
      const messageId = String(body.message_id ?? '');
      const subject = String(body.subject ?? '').trim().slice(0, 200);
      const text = String(body.body ?? '').trim().slice(0, 10_000);
      if (!UUID_RE.test(messageId) || subject.length < 2 || text.length < 2) return json({ error: 'Réponse incomplète.' }, 400, cors);
      const { data: message } = await user.from('contact_messages').select('*').eq('id', messageId).maybeSingle();
      if (!message) return json({ error: 'Message introuvable.' }, 404, cors);

      const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937">${escapeHtml(text).replace(/\n/g, '<br>')}
        <hr style="border:0;border-top:1px solid #e5e7eb;margin:24px 0"><p style="font-size:12px;color:#6b7280">Votre message du
        ${new Date(message.created_at).toLocaleDateString('fr-FR')} :<br>${escapeHtml(message.message).replace(/\n/g, '<br>')}</p></div>`;
      const [result] = await provider.sendBatch([{ to: message.email, subject, html, text }]);
      if (!result.ok) return json({ error: `Le fournisseur a refusé l’envoi (${result.error}). Rien n’a été envoyé.` }, 502, cors);

      await admin.from('contact_message_history').insert({
        message_id: messageId, actor_id: auth.user.id, action: 'email_sent',
        details: { provider: provider.name, provider_message_id: result.messageId, subject },
      });
      // Status change goes through the admin's session so the journal records who answered.
      await user.from('contact_messages').update({ status: 'replied' }).eq('id', messageId);
      return json({ ok: true }, 200, cors);
    }

    return json({ error: 'Action inconnue.' }, 400, cors);
  } catch (err) {
    console.error('admin_mail_error', body.action, err instanceof Error ? err.message : err);
    return json({ error: 'Erreur du service d’e-mail.' }, 500, cors);
  }
});
