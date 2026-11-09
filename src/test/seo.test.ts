import { describe, expect, it, vi } from 'vitest';
import {
  SEO_CONFIG, buildRobots, buildSitemap, clampDescription, injectHead, jsonLdScript, pageTitle, propertySeo,
  STATIC_SITEMAP_PAGES, websiteJsonLd,
} from '@/lib/seo-core';
import { buildDynamicSitemap, resolvePage, type RenderDeps } from '../../api/_lib/render-core';

const listing = {
  id: 'p1', title: 'Belle maison avec jardin', slug: 'belle-maison-raboteau', description: 'Maison lumineuse, proche du centre.',
  property_type: 'house', listing_type: 'sale', price: 4500000, price_currency: 'HTG', bedrooms: 3, bathrooms: 2,
  building_area: 140, land_area: null, published_at: '2026-11-01T00:00:00Z', created_at: '2026-10-30T00:00:00Z',
  city: { name: 'Gonaïves', slug: 'gonaives' }, neighborhood: { name: 'Raboteau' },
  images: [{ source: 'upload', url: 'x', storage_path: 'properties/p1/a.webp', is_primary: true, sort_order: 0 }],
};

function deps(routes: Record<string, unknown>): RenderDeps {
  return {
    supabaseUrl: 'https://proj.supabase.co', anonKey: 'anon', siteUrl: 'https://ciento-immobilier.com',
    fetch: vi.fn(async (url: string) => {
      const key = Object.keys(routes).find((k) => url.includes(k));
      return new Response(JSON.stringify(key ? routes[key] : []), { status: 200 });
    }),
  };
}

describe('brand SEO', () => {
  it('uses the official title and description', () => {
    expect(pageTitle()).toBe('CIENTO-IMMOBILIER | Trouvez votre maison, appartement ou terrain en Haïti');
    expect(pageTitle('Contact')).toBe('Contact | CIENTO-IMMOBILIER');
    expect(SEO_CONFIG.description).toMatch(/^Découvrez CIENTO-IMMOBILIER/);
    expect(websiteJsonLd('https://ciento-immobilier.com/')).toMatchObject({ '@type': 'WebSite', url: 'https://ciento-immobilier.com' });
  });

  it('keeps descriptions within search-result length', () => {
    expect(clampDescription('a '.repeat(200)).length).toBeLessThanOrEqual(160);
  });
});

describe('listing metadata', () => {
  it('is natural, local and specific', () => {
    const seo = propertySeo(listing);
    expect(seo.title).toContain('Maison à vendre aux Gonaïves (Raboteau)');
    expect(seo.title).toContain('HTG');
    expect(seo.description).toContain('Belle maison avec jardin');
    expect(seo.description.length).toBeLessThanOrEqual(160);
    expect(propertySeo({ ...listing, listing_type: 'rent', property_type: 'apartment', city: { name: 'Port-au-Prince' }, neighborhood: null }).title)
      .toMatch(/^Appartement à louer à Port-au-Prince/);
  });

  it('never exposes private owner data', () => {
    const seo = propertySeo({ ...listing, owner: { email: 'secret@x.ht', phone: '+50900000000' } } as typeof listing);
    expect(JSON.stringify(seo)).not.toMatch(/secret@x\.ht|\+50900000000/);
  });
});

describe('server-side head injection', () => {
  const shell = '<html><head><title>Default</title><meta name="description" content="d" /><meta property="og:title" content="x" /></head><body></body></html>';

  it('replaces default tags and escapes values', () => {
    const html = injectHead(shell, { title: 'Villa "luxe" <b>', description: 'desc', canonical: 'https://c.test/a', jsonLd: [{ name: '</script><script>alert(1)</script>' }] });
    expect(html).not.toContain('<title>Default</title>');
    expect(html).toContain('<title>Villa &quot;luxe&quot; &lt;b&gt;</title>');
    expect(html).toContain('<link rel="canonical" href="https://c.test/a" />');
    expect(html.match(/og:title/g)).toHaveLength(1);
    expect(html).not.toContain('</script><script>alert(1)');
    expect(jsonLdScript({ a: '<' })).toContain('\\u003c');
  });
});

describe('pages rendered for crawlers', () => {
  it('published listing: meta, canonical, signed image, JSON-LD', async () => {
    const d = deps({ 'rest/v1/properties': [listing], 'object/sign': { signedURL: '/object/sign/property-images/a.webp?token=t' } });
    const result = await resolvePage('property', 'belle-maison-raboteau', 'gonaives', d);
    expect(result.kind).toBe('html');
    if (result.kind !== 'html') return;
    expect(result.status).toBe(200);
    expect(result.meta.canonical).toBe('https://ciento-immobilier.com/annonces/gonaives/belle-maison-raboteau');
    expect(result.meta.image).toBe('https://proj.supabase.co/storage/v1/object/sign/property-images/a.webp?token=t');
    expect(result.meta.noindex).toBeFalsy();
    expect(JSON.stringify(result.meta.jsonLd)).toContain('RealEstateListing');
    expect(JSON.stringify(result.meta.jsonLd)).toContain('BreadcrumbList');
    // Only published & active listings are requested.
    expect((d.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain('is_published=eq.true&status=eq.active');
  });

  it('removed / expired listing: 404 + noindex', async () => {
    const result = await resolvePage('property', 'vendue', null, deps({}));
    expect(result).toMatchObject({ kind: 'html', status: 404, meta: { noindex: true } });
  });

  it('wrong city in the URL: 301 to the canonical URL (no duplicate content)', async () => {
    const result = await resolvePage('property', 'belle-maison-raboteau', 'port-au-prince', deps({ 'rest/v1/properties': [listing] }));
    expect(result).toEqual({ kind: 'redirect', location: 'https://ciento-immobilier.com/annonces/gonaives/belle-maison-raboteau' });
  });

  it('unverified agency is not indexed; malformed slugs are ignored', async () => {
    const result = await resolvePage('agency', 'agence-x', null, deps({ 'rest/v1/agencies': [{ name: 'Agence X', slug: 'agence-x', is_verified: false, phone: '1', city: null }] }));
    expect(result).toMatchObject({ kind: 'html', meta: { noindex: true } });
    expect(await resolvePage('property', "x' or 1=1", null, deps({}))).toEqual({ kind: 'passthrough' });
  });
});

describe('indexing files', () => {
  it('sitemap lists public pages, listings, agencies and services only', async () => {
    const xml = await buildDynamicSitemap(deps({
      'rest/v1/properties': [{ slug: 'belle-maison', updated_at: '2026-11-02T00:00:00Z', city: { slug: 'gonaives' } }],
      'rest/v1/agencies': [{ slug: 'agence-x', updated_at: '2026-11-02T00:00:00Z' }],
      'rest/v1/service_categories': [{ slug: 'estimation-immobiliere', updated_at: '2026-11-02T00:00:00Z' }],
    }));
    expect(xml).toContain('<loc>https://ciento-immobilier.com/annonces/gonaives/belle-maison</loc>');
    expect(xml).toContain('<lastmod>2026-11-02</lastmod>');
    expect(xml).toContain('/agences/agence-x');
    expect(xml).toContain('/services/estimation-immobiliere');
    expect(xml).not.toMatch(/dashboard|admin|auth\//);
    expect(xml).toContain('/annonces?listing_type=sale'.replace('&', '&amp;'));
    expect(buildSitemap('https://c.test', STATIC_SITEMAP_PAGES).startsWith('<?xml')).toBe(true);
  });

  it('robots.txt blocks private areas and points to the sitemap', () => {
    const robots = buildRobots('https://ciento-immobilier.com/');
    for (const path of ['/dashboard', '/admin', '/auth/']) expect(robots).toContain(`Disallow: ${path}`);
    expect(robots).toContain('Sitemap: https://ciento-immobilier.com/sitemap.xml');
    expect(robots).toContain('Allow: /');
  });
});
