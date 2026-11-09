// Central SEO configuration and builders. Pure TypeScript with no browser or
// Vite dependency: used by the React app (Helmet) AND the Vercel functions
// (server-side meta injection, sitemap.xml). Edit brand texts here only.

export const SEO_CONFIG = {
  siteName: 'CIENTO-IMMOBILIER',
  legalName: 'Ciento-Immobilier',
  defaultTitle: 'CIENTO-IMMOBILIER | Trouvez votre maison, appartement ou terrain en Haïti',
  titleSuffix: ' | CIENTO-IMMOBILIER',
  description:
    'Découvrez CIENTO-IMMOBILIER, votre plateforme immobilière en Haïti pour rechercher, vendre, acheter et louer des maisons, appartements, terrains et locaux commerciaux.',
  ogImage: '/og-image.jpg',
  ogImageWidth: 1200,
  ogImageHeight: 630,
  logo: '/logo.jpg',
  locale: 'fr_HT',
  language: 'fr',
  country: 'HT',
  region: 'Artibonite',
  city: 'Gonaïves',
  email: 'contact@cientoimmobilier.com',
  telephone: '+50932353622',
} as const;

const TYPE_LABELS: Record<string, string> = {
  house: 'Maison', apartment: 'Appartement', land: 'Terrain', commercial: 'Local commercial', building: 'Immeuble', villa: 'Villa',
};
// Gendered agreement: "Maison à vendre", "Terrain à vendre" — the listing verb is invariable in French.
const LISTING_LABELS: Record<string, string> = { sale: 'à vendre', rent: 'à louer', sale_or_rent: 'à vendre ou à louer' };

export function normalizeSiteUrl(url: string | undefined): string {
  return (url || 'https://ciento-immobilier.com').replace(/\/+$/, '');
}

export function absoluteUrl(siteUrl: string, path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${normalizeSiteUrl(siteUrl)}${path.startsWith('/') ? path : `/${path}`}`;
}

export function pageTitle(title?: string): string {
  if (!title) return SEO_CONFIG.defaultTitle;
  const full = `${title}${SEO_CONFIG.titleSuffix}`;
  return full.length > 70 ? title.slice(0, 70) : full;
}

export function clampDescription(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 80 ? cut.lastIndexOf(' ') : cut.length)}…`;
}

export interface PropertySeoInput {
  title: string;
  description?: string | null;
  property_type: string;
  listing_type: string;
  price: number;
  price_currency: string;
  bedrooms?: number | null;
  bathrooms?: number | null;
  building_area?: number | null;
  land_area?: number | null;
  city?: { name?: string | null } | null;
  neighborhood?: { name?: string | null } | null;
}

export function formatSeoPrice(price: number, currency: string): string {
  const n = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(price).replace(/\u202f|\u00a0/g, ' ');
  return currency === 'USD' ? `${n} $ US` : `${n} ${currency}`;
}

/**
 * Natural, listing-specific metadata, e.g. "Maison à vendre aux Gonaïves (Raboteau) — 3 ch. — 4 500 000 HTG".
 * Only public listing data is used: never the owner's name, e-mail or phone.
 */
export function propertySeo(p: PropertySeoInput): { title: string; description: string } {
  const type = TYPE_LABELS[p.property_type] ?? 'Bien immobilier';
  const listing = LISTING_LABELS[p.listing_type] ?? '';
  const city = p.city?.name ? (/^gona[iï]ves$/i.test(p.city.name) ? 'aux Gonaïves' : `à ${p.city.name}`) : 'en Haïti';
  const where = p.neighborhood?.name ? `${city} (${p.neighborhood.name})` : city;
  const area = p.building_area || p.land_area;
  const facts = [
    p.bedrooms ? `${p.bedrooms} ch.` : null,
    p.bathrooms ? `${p.bathrooms} sdb` : null,
    area ? `${area} m²` : null,
  ].filter(Boolean).join(', ');
  const price = formatSeoPrice(p.price, p.price_currency) + (p.listing_type === 'rent' ? '/mois' : '');
  const title = `${type} ${listing} ${where}${facts ? ` — ${facts}` : ''} — ${price}`.replace(/\s+/g, ' ');
  const description = clampDescription(
    `${p.title}. ${type} ${listing} ${where}${facts ? `, ${facts}` : ''}, ${price}. ${p.description ?? ''}`,
  );
  return { title: title.length > 70 ? `${type} ${listing} ${where} — ${price}`.slice(0, 70) : title, description };
}

// ---------------------------------------------------------------- JSON-LD
export type JsonLd = Record<string, unknown>;

export function organizationJsonLd(siteUrl: string, sameAs: string[] = []): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${normalizeSiteUrl(siteUrl)}/#organization`,
    name: SEO_CONFIG.siteName,
    alternateName: SEO_CONFIG.legalName,
    url: normalizeSiteUrl(siteUrl),
    logo: absoluteUrl(siteUrl, SEO_CONFIG.logo),
    email: SEO_CONFIG.email,
    telephone: SEO_CONFIG.telephone,
    address: { '@type': 'PostalAddress', addressLocality: SEO_CONFIG.city, addressRegion: SEO_CONFIG.region, addressCountry: SEO_CONFIG.country },
    ...(sameAs.length ? { sameAs } : {}),
  };
}

export function websiteJsonLd(siteUrl: string): JsonLd {
  const url = normalizeSiteUrl(siteUrl);
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${url}/#website`,
    name: SEO_CONFIG.siteName,
    url,
    inLanguage: SEO_CONFIG.language,
    publisher: { '@id': `${url}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${url}/annonces?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function breadcrumbJsonLd(siteUrl: string, items: { name: string; path?: string }[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      ...(item.path ? { item: absoluteUrl(siteUrl, item.path) } : {}),
    })),
  };
}

/** schema.org RealEstateListing: only real data, no invented ratings/availability. */
export function listingJsonLd(siteUrl: string, p: PropertySeoInput & {
  slug: string; citySlug: string; published_at?: string | null; created_at: string; images?: string[];
}): JsonLd {
  const seo = propertySeo(p);
  const url = absoluteUrl(siteUrl, `/annonces/${p.citySlug}/${p.slug}`);
  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: p.title,
    description: seo.description,
    url,
    datePosted: p.published_at || p.created_at,
    ...(p.images?.length ? { image: p.images.slice(0, 6) } : {}),
    offers: {
      '@type': 'Offer',
      price: p.price,
      priceCurrency: p.price_currency,
      businessFunction: p.listing_type === 'rent' ? 'http://purl.org/goodrelations/v1#LeaseOut' : 'http://purl.org/goodrelations/v1#Sell',
    },
    contentLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: p.city?.name ?? undefined,
        addressRegion: p.neighborhood?.name ?? undefined,
        addressCountry: SEO_CONFIG.country,
      },
    },
  };
}

// ---------------------------------------------------------------- Server-side helpers
export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** JSON-LD inside <script>: escape "<" so the payload can never close the tag. */
export function jsonLdScript(data: JsonLd | JsonLd[]): string {
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}

export interface HeadMeta {
  title: string;
  description: string;
  canonical: string;
  image?: string;
  type?: 'website' | 'article';
  noindex?: boolean;
  jsonLd?: JsonLd[];
}

/** Replaces the default <title>/<meta> of index.html with page-specific values. */
export function injectHead(html: string, meta: HeadMeta): string {
  const tags = [
    `<title>${escapeHtml(meta.title)}</title>`,
    `<meta name="description" content="${escapeHtml(meta.description)}" />`,
    `<link rel="canonical" href="${escapeHtml(meta.canonical)}" />`,
    meta.noindex ? '<meta name="robots" content="noindex, follow" />' : '',
    `<meta property="og:type" content="${meta.type ?? 'website'}" />`,
    `<meta property="og:title" content="${escapeHtml(meta.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(meta.canonical)}" />`,
    meta.image ? `<meta property="og:image" content="${escapeHtml(meta.image)}" />` : '',
    `<meta name="twitter:title" content="${escapeHtml(meta.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(meta.description)}" />`,
    meta.image ? `<meta name="twitter:image" content="${escapeHtml(meta.image)}" />` : '',
    ...(meta.jsonLd ?? []).map((d) => jsonLdScript(d)),
  ].filter(Boolean).join('\n    ');

  return html
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<meta\s+name="description"[^>]*>/i, '')
    .replace(/<meta\s+property="og:(title|description|url|image|type)"[^>]*>/gi, '')
    .replace(/<meta\s+name="twitter:(title|description|image)"[^>]*>/gi, '')
    .replace(/<\/head>/i, `    ${tags}\n  </head>`);
}

export interface SitemapEntry { path: string; lastmod?: string | null; changefreq?: string; priority?: number }

export function buildSitemap(siteUrl: string, entries: SitemapEntry[]): string {
  const urls = entries.map((e) => [
    '  <url>',
    `    <loc>${escapeHtml(absoluteUrl(siteUrl, e.path))}</loc>`,
    e.lastmod ? `    <lastmod>${new Date(e.lastmod).toISOString().slice(0, 10)}</lastmod>` : '',
    e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : '',
    e.priority !== undefined ? `    <priority>${e.priority.toFixed(1)}</priority>` : '',
    '  </url>',
  ].filter(Boolean).join('\n'));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

/** Public, indexable static pages (filtered search URLs are deliberately excluded). */
export const STATIC_SITEMAP_PAGES: SitemapEntry[] = [
  { path: '/', changefreq: 'daily', priority: 1.0 },
  { path: '/annonces', changefreq: 'daily', priority: 0.9 },
  { path: '/annonces?listing_type=sale', changefreq: 'daily', priority: 0.8 },
  { path: '/louer', changefreq: 'daily', priority: 0.8 },
  { path: '/vendre', changefreq: 'monthly', priority: 0.6 },
  { path: '/airbnb', changefreq: 'weekly', priority: 0.6 },
  { path: '/agences', changefreq: 'weekly', priority: 0.7 },
  { path: '/agents', changefreq: 'weekly', priority: 0.5 },
  { path: '/services', changefreq: 'monthly', priority: 0.7 },
  { path: '/tarifs', changefreq: 'monthly', priority: 0.5 },
  { path: '/contact', changefreq: 'yearly', priority: 0.4 },
  { path: '/faq', changefreq: 'monthly', priority: 0.4 },
  { path: '/confidentialite', changefreq: 'yearly', priority: 0.2 },
  { path: '/conditions', changefreq: 'yearly', priority: 0.2 },
];

export const DISALLOWED_PATHS = ['/dashboard', '/admin', '/auth/', '/api/'];

export function buildRobots(siteUrl: string): string {
  return [
    'User-agent: *',
    'Allow: /',
    ...DISALLOWED_PATHS.map((p) => `Disallow: ${p}`),
    // Filtered result pages create near-duplicates; the canonical /annonces stays crawlable.
    'Disallow: /*?*min_price=',
    'Disallow: /*?*max_price=',
    'Disallow: /*?*q=',
    '',
    `Sitemap: ${normalizeSiteUrl(siteUrl)}/sitemap.xml`,
    '',
  ].join('\n');
}
