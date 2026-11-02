const responseHeaders = {
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  'Content-Type': 'text/html; charset=utf-8',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

function page(message: string, token?: string, status = 200): Response {
  const action = token
    ? `<form method="post"><input type="hidden" name="token" value="${token}"><button type="submit">Confirmer</button></form>`
    : '';
  const html = `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
    <title>Newsletter Ciento-Immobilier</title>
    <style>body{font:16px Arial,sans-serif;max-width:560px;margin:4rem auto;padding:0 1rem;color:#1f2937}button{padding:.75rem 1rem;background:#d4a84b;border:0;border-radius:6px;font-weight:600;cursor:pointer}</style>
    <h1>Ciento-Immobilier</h1><p>${message}</p>${action}</html>`;
  return new Response(html, { status, headers: responseHeaders });
}

Deno.serve(async (request: Request) => {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') || '';
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return page('Le lien est invalide ou expiré.', undefined, 400);
  }

  if (request.method === 'GET') {
    return page('Confirmez votre inscription ou votre désinscription à la newsletter.', token);
  }
  if (request.method !== 'POST') {
    return page('Méthode non autorisée.', undefined, 405);
  }

  const form = await request.formData();
  if (form.get('token') !== token) {
    return page('Le lien est invalide ou expiré.', undefined, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Supabase service configuration is incomplete.');
    return page('Service temporairement indisponible.', undefined, 503);
  }

  const callRpc = async (functionName: string): Promise<boolean> => {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_token: token }),
    });
    if (!response.ok) {
      console.error(`Newsletter ${functionName} RPC failed:`, response.status);
      throw new Error('Newsletter operation failed.');
    }
    return response.json();
  };

  const confirmed = await callRpc('confirm_newsletter_subscription');
  if (confirmed) {
    return page('Votre adresse e-mail est confirmée. Votre inscription est active.');
  }

  const unsubscribed = await callRpc('unsubscribe_newsletter');
  if (unsubscribed) {
    return page('Votre désinscription a bien été prise en compte.');
  }

  return page('Le lien est invalide, déjà utilisé ou expiré.', undefined, 400);
});
