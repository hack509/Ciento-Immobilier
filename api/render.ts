// Vercel Edge Function: serves index.html with page-specific SEO tags for
// listings, agencies and services (crawlers and social previews do not run JS).
// Any failure falls back to the unchanged SPA shell.
import { applyMeta, resolvePage } from './_lib/render-core';

export const config = { runtime: 'edge' };

declare const process: { env: Record<string, string | undefined> };

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const shell = await fetch(new URL('/index.html', url.origin));
  const html = await shell.text();
  const htmlHeaders = { 'Content-Type': 'text/html; charset=utf-8' };

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const siteUrl = process.env.VITE_APP_URL || url.origin;
  if (!supabaseUrl || !anonKey) return new Response(html, { status: 200, headers: htmlHeaders });

  try {
    const result = await resolvePage(url.searchParams.get('type') ?? '', url.searchParams.get('slug') ?? '',
      url.searchParams.get('city'), { supabaseUrl, anonKey, siteUrl, fetch: (i, init) => fetch(i, init) });
    if (result.kind === 'redirect') return Response.redirect(result.location, 301);
    if (result.kind === 'passthrough') return new Response(html, { status: 200, headers: htmlHeaders });
    return new Response(applyMeta(html, result.meta), {
      status: result.status,
      headers: { ...htmlHeaders, 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (err) {
    console.error('seo_render_failed', err instanceof Error ? err.message : err);
    return new Response(html, { status: 200, headers: htmlHeaders });
  }
}
