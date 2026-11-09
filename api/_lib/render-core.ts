// Server-side SEO for the SPA (Vercel Edge Functions). Data comes from the
// Supabase REST API with the public anon key, so Row Level Security decides
// what is public: unpublished / expired / removed listings are never exposed.
import {
  SEO_CONFIG, STATIC_SITEMAP_PAGES, absoluteUrl, breadcrumbJsonLd, buildSitemap, clampDescription, injectHead,
  listingJsonLd, pageTitle, propertySeo, type HeadMeta, type SitemapEntry,
} from '../../src/lib/seo-core';

export interface RenderDeps {
  supabaseUrl: string;
  anonKey: string;
  siteUrl: string;
  fetch: (input: string, init?: RequestInit) => Promise<Response>;
}

async function rest<T>(deps: RenderDeps, path: string): Promise<T[]> {
  const response = await deps.fetch(`${deps.supabaseUrl}/rest/v1/${path}`, {
    headers: { apikey: deps.anonKey, Authorization: `Bearer ${deps.anonKey}`, Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`supabase_${response.status}`);
  return (await response.json()) as T[];
}

/** Stable-enough image URL for social previews (signed 7 days; external images as-is). */
async function signImage(deps: RenderDeps, image: { source?: string; url: string; storage_path: string | null }): Promise<string | undefined> {
  if (image.source === 'external') return image.url;
  if (!image.storage_path) return undefined;
  const response = await deps.fetch(`${deps.supabaseUrl}/storage/v1/object/sign/property-images/${image.storage_path}`, {
    method: 'POST',
    headers: { apikey: deps.anonKey, Authorization: `Bearer ${deps.anonKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: 7 * 24 * 3600 }),
  });
  if (!response.ok) return undefined;
  const body = (await response.json()) as { signedURL?: string };
  return body.signedURL ? `${deps.supabaseUrl}/storage/v1${body.signedURL}` : undefined;
}

const SAFE_SLUG = /^[a-z0-9-]{1,200}$/i;

export type RenderResult =
  | { kind: 'html'; status: number; meta: HeadMeta }
  | { kind: 'redirect'; location: string }
  | { kind: 'passthrough' };

type ListingRow = {
  id: string; title: string; slug: string; description: string; property_type: string; listing_type: string;
  price: number; price_currency: string; bedrooms: number; bathrooms: number; building_area: number | null;
  land_area: number | null; published_at: string | null; created_at: string;
  city: { name: string; slug: string } | null; neighborhood: { name: string } | null;
  images: { source?: string; url: string; storage_path: string | null; is_primary: boolean; sort_order: number }[];
};

export async function resolvePage(type: string, slug: string, city: string | null, deps: RenderDeps): Promise<RenderResult> {
  if (!SAFE_SLUG.test(slug)) return { kind: 'passthrough' };

  if (type === 'property') {
    const rows = await rest<ListingRow>(deps,
      `properties?slug=eq.${slug}&is_published=eq.true&status=eq.active&limit=1&select=` +
      'id,title,slug,description,property_type,listing_type,price,price_currency,bedrooms,bathrooms,building_area,land_area,published_at,created_at,' +
      'city:cities!properties_city_id_fkey(name,slug),neighborhood:neighborhoods!properties_neighborhood_id_fkey(name),' +
      'images:property_images!property_images_property_id_fkey(source,url,storage_path,is_primary,sort_order)');
    const p = rows[0];
    if (!p) {
      return { kind: 'html', status: 404, meta: {
        title: pageTitle('Annonce indisponible'), description: 'Cette annonce n’existe pas, a expiré ou n’est plus publiée.',
        canonical: absoluteUrl(deps.siteUrl, '/annonces'), noindex: true,
      } };
    }
    const canonicalPath = `/annonces/${p.city?.slug ?? 'inconnu'}/${p.slug}`;
    if (city && p.city?.slug && city !== p.city.slug) return { kind: 'redirect', location: absoluteUrl(deps.siteUrl, canonicalPath) };
    const ordered = [...(p.images ?? [])].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order);
    const image = ordered[0] ? await signImage(deps, ordered[0]) : undefined;
    const seo = propertySeo(p);
    return { kind: 'html', status: 200, meta: {
      title: pageTitle(seo.title), description: seo.description, canonical: absoluteUrl(deps.siteUrl, canonicalPath),
      image: image ?? absoluteUrl(deps.siteUrl, SEO_CONFIG.ogImage), type: 'article',
      jsonLd: [
        listingJsonLd(deps.siteUrl, { ...p, citySlug: p.city?.slug ?? 'inconnu', images: image ? [image] : [] }),
        breadcrumbJsonLd(deps.siteUrl, [{ name: 'Accueil', path: '/' }, { name: 'Annonces', path: '/annonces' }, { name: p.title, path: canonicalPath }]),
      ],
    } };
  }

  if (type === 'agency') {
    const rows = await rest<{ name: string; slug: string; tagline: string | null; description: string | null; logo_url: string | null;
      phone: string; email: string | null; website: string | null; address: string | null; is_verified: boolean; city: { name: string } | null }>(deps,
      `agencies?slug=eq.${slug}&is_active=eq.true&limit=1&select=name,slug,tagline,description,logo_url,phone,email,website,address,is_verified,city:cities(name)`);
    const a = rows[0];
    if (!a) return { kind: 'html', status: 404, meta: { title: pageTitle('Agence introuvable'), description: SEO_CONFIG.description, canonical: absoluteUrl(deps.siteUrl, '/agences'), noindex: true } };
    const path = `/agences/${a.slug}`;
    return { kind: 'html', status: 200, meta: {
      title: pageTitle(`${a.name} — agence immobilière${a.city?.name ? ` à ${a.city.name}` : ''}`),
      description: clampDescription(a.tagline || a.description || `${a.name}, agence immobilière en Haïti sur ${SEO_CONFIG.siteName}.`),
      canonical: absoluteUrl(deps.siteUrl, path), image: a.logo_url ?? undefined, noindex: !a.is_verified,
      jsonLd: a.is_verified ? [{
        '@context': 'https://schema.org', '@type': 'RealEstateAgent', name: a.name, url: absoluteUrl(deps.siteUrl, path),
        logo: a.logo_url ?? undefined, telephone: a.phone, email: a.email ?? undefined,
        address: { '@type': 'PostalAddress', streetAddress: a.address ?? undefined, addressLocality: a.city?.name, addressCountry: 'HT' },
      }, breadcrumbJsonLd(deps.siteUrl, [{ name: 'Accueil', path: '/' }, { name: 'Agences', path: '/agences' }, { name: a.name, path }])] : [],
    } };
  }

  if (type === 'service') {
    const rows = await rest<{ name: string; slug: string; short_description: string }>(deps,
      `service_categories?slug=eq.${slug}&is_active=eq.true&limit=1&select=name,slug,short_description`);
    const s = rows[0];
    if (!s) return { kind: 'html', status: 404, meta: { title: pageTitle('Service introuvable'), description: SEO_CONFIG.description, canonical: absoluteUrl(deps.siteUrl, '/services'), noindex: true } };
    const path = `/services/${s.slug}`;
    return { kind: 'html', status: 200, meta: {
      title: pageTitle(`${s.name} en Haïti`), description: clampDescription(s.short_description), canonical: absoluteUrl(deps.siteUrl, path),
      jsonLd: [{
        '@context': 'https://schema.org', '@type': 'Service', name: s.name, serviceType: s.name, areaServed: 'HT',
        provider: { '@id': `${absoluteUrl(deps.siteUrl, '/')}#organization` },
      }, breadcrumbJsonLd(deps.siteUrl, [{ name: 'Accueil', path: '/' }, { name: 'Services', path: '/services' }, { name: s.name, path }])],
    } };
  }

  return { kind: 'passthrough' };
}

export function applyMeta(html: string, meta: HeadMeta): string {
  return injectHead(html, meta);
}

/** sitemap.xml: static pages + published listings + verified agencies + services. */
export async function buildDynamicSitemap(deps: RenderDeps): Promise<string> {
  const entries: SitemapEntry[] = [...STATIC_SITEMAP_PAGES];
  const [listings, agencies, services] = await Promise.all([
    rest<{ slug: string; updated_at: string; city: { slug: string } | null }>(deps,
      'properties?is_published=eq.true&status=eq.active&select=slug,updated_at,city:cities!properties_city_id_fkey(slug)&order=updated_at.desc&limit=45000'),
    rest<{ slug: string; updated_at: string }>(deps, 'agencies?is_active=eq.true&is_verified=eq.true&select=slug,updated_at&limit=2000'),
    rest<{ slug: string; updated_at: string }>(deps, 'service_categories?is_active=eq.true&select=slug,updated_at'),
  ]);
  for (const l of listings) entries.push({ path: `/annonces/${l.city?.slug ?? 'inconnu'}/${l.slug}`, lastmod: l.updated_at, changefreq: 'weekly', priority: 0.8 });
  for (const a of agencies) entries.push({ path: `/agences/${a.slug}`, lastmod: a.updated_at, changefreq: 'weekly', priority: 0.6 });
  for (const s of services) entries.push({ path: `/services/${s.slug}`, lastmod: s.updated_at, changefreq: 'monthly', priority: 0.6 });
  return buildSitemap(deps.siteUrl, entries);
}
