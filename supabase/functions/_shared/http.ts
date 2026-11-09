// Small HTTP helpers shared by Edge Functions (CORS restricted by ALLOWED_ORIGINS).

export function corsHeaders(origin: string | null, allowedOrigins: string[]): Record<string, string> {
  const allow = origin && (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) ? origin : allowedOrigins[0] ?? '*';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

export function parseOrigins(value: string | undefined): string[] {
  return (value ?? '').split(',').map((o) => o.trim()).filter(Boolean);
}

export function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
