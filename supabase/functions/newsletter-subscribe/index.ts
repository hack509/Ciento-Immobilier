const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Méthode non autorisée.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const fromEmail = Deno.env.get('NEWSLETTER_FROM_EMAIL');
  if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !fromEmail) {
    console.error('Newsletter mail configuration is incomplete.');
    return jsonResponse({ error: 'Service temporairement indisponible.' }, 503);
  }

  let payload: { email?: unknown };
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Corps JSON invalide.' }, 400);
  }

  if (typeof payload.email !== 'string') {
    return jsonResponse({ error: 'Adresse e-mail invalide.' }, 400);
  }
  const email = payload.email.trim().toLowerCase();
  if (
    email.length > 254 ||
    !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email)
  ) {
    return jsonResponse({ error: 'Adresse e-mail invalide.' }, 400);
  }

  const clientIp =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown';
  const tokenResponse = await fetch(
    `${supabaseUrl}/rest/v1/rpc/request_newsletter_subscription`,
    {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_email: email, p_client_ip: clientIp }),
    }
  );
  if (!tokenResponse.ok) {
    const errorBody = await tokenResponse.text();
    if (tokenResponse.status === 400 && /"code"\s*:\s*"P0001"/.test(errorBody)) {
      return jsonResponse({ error: 'Trop de demandes. Réessayez plus tard.' }, 429);
    }
    console.error('Newsletter token request failed:', tokenResponse.status);
    return jsonResponse({ error: 'Impossible de traiter la demande.' }, 500);
  }

  const tokenRows: { out_token: string; out_purpose: string }[] = await tokenResponse.json();
  const token = tokenRows[0];
  if (
    !token ||
    !/^[a-f0-9]{64}$/.test(token.out_token) ||
    !['confirm', 'unsubscribe'].includes(token.out_purpose)
  ) {
    console.error('Newsletter token RPC returned an invalid response.');
    return jsonResponse({ error: 'Impossible de traiter la demande.' }, 500);
  }

  const actionUrl = `${supabaseUrl}/functions/v1/newsletter-manage?token=${token.out_token}`;
  const isConfirmation = token.out_purpose === 'confirm';
  const subject = isConfirmation
    ? 'Confirmez votre inscription à Ciento-Immobilier'
    : 'Gérez votre inscription à la newsletter Ciento-Immobilier';
  const actionLabel = isConfirmation ? 'Confirmer mon inscription' : 'Me désinscrire';
  const message = isConfirmation
    ? 'Confirmez votre adresse e-mail pour activer votre inscription à la newsletter.'
    : 'Cette adresse est déjà inscrite. Vous pouvez vous désinscrire en confirmant ci-dessous.';
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:32px auto;color:#1f2937">
    <h1 style="font-size:22px">Ciento-Immobilier</h1>
    <p>${message}</p>
    <p><a href="${actionUrl}" style="display:inline-block;padding:12px 18px;background:#d4a84b;color:#111827;text-decoration:none;border-radius:6px">${actionLabel}</a></p>
    <p style="font-size:13px;color:#6b7280">Ce lien expire dans 7 jours. Si vous n'avez pas demandé cette action, ignorez ce message.</p>
  </div>`;

  const mailResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [email],
      subject,
      html,
    }),
  });
  if (!mailResponse.ok) {
    console.error('Newsletter email delivery failed:', mailResponse.status);
    return jsonResponse({ error: 'Impossible d’envoyer le message de confirmation.' }, 502);
  }

  return jsonResponse(
    { success: true, message: 'Vérifiez votre boîte e-mail pour confirmer ou gérer votre inscription.' },
    200
  );
});
