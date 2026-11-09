// Provider webhooks → delivery / open / click / bounce statistics.
//   Resend: signed with Svix (RESEND_WEBHOOK_SECRET = "whsec_…")
//   Brevo : URL secret  …/email-webhook?provider=brevo&secret=<BREVO_WEBHOOK_SECRET>
// Hard bounces and complaints suspend the subscriber (no further sends).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { mapBrevoEvent, mapResendEvent, verifySvixSignature } from '../_shared/email.ts';

const env = Deno.env.toObject();

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return new Response('Unavailable', { status: 503 });
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const url = new URL(request.url);
  const raw = await request.text();
  let messageId: string | undefined;
  let event = null;

  if (url.searchParams.get('provider') === 'brevo') {
    if (!env.BREVO_WEBHOOK_SECRET || url.searchParams.get('secret') !== env.BREVO_WEBHOOK_SECRET) {
      return new Response('Forbidden', { status: 403 });
    }
    const payload = JSON.parse(raw) as { event?: string; 'message-id'?: string };
    messageId = payload['message-id'];
    event = mapBrevoEvent(payload.event ?? '');
  } else {
    if (!env.RESEND_WEBHOOK_SECRET) return new Response('Webhook not configured', { status: 503 });
    const valid = await verifySvixSignature(env.RESEND_WEBHOOK_SECRET, {
      id: request.headers.get('svix-id'),
      timestamp: request.headers.get('svix-timestamp'),
      signature: request.headers.get('svix-signature'),
    }, raw);
    if (!valid) return new Response('Invalid signature', { status: 401 });
    const payload = JSON.parse(raw) as { type?: string; data?: { email_id?: string } };
    messageId = payload.data?.email_id;
    event = mapResendEvent(payload.type ?? '');
  }

  if (messageId && event) {
    const { error } = await admin.rpc('record_email_event', { p_message_id: messageId, p_event: event });
    if (error) {
      console.error('record_email_event failed', error.message);
      return new Response('Retry', { status: 500 });
    }
  }
  return new Response('ok', { status: 200 });
});
