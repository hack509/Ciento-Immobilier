// Vercel Edge Function behind /sitemap.xml (see vercel.json rewrites).
import { buildDynamicSitemap } from './_lib/render-core';
import { STATIC_SITEMAP_PAGES, buildSitemap } from '../src/lib/seo-core';

export const config = { runtime: 'edge' };

declare const process: { env: Record<string, string | undefined> };

export default async function handler(request: Request): Promise<Response> {
  const siteUrl = process.env.VITE_APP_URL || new URL(request.url).origin;
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const headers = { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' };

  try {
    if (!supabaseUrl || !anonKey) throw new Error('supabase_not_configured');
    const xml = await buildDynamicSitemap({ supabaseUrl, anonKey, siteUrl, fetch: (i, init) => fetch(i, init) });
    return new Response(xml, { status: 200, headers });
  } catch (err) {
    console.error('sitemap_failed', err instanceof Error ? err.message : err);
    // Degraded but valid sitemap: static pages only.
    return new Response(buildSitemap(siteUrl, STATIC_SITEMAP_PAGES), { status: 200, headers: { ...headers, 'Cache-Control': 'public, s-maxage=300' } });
  }
}
