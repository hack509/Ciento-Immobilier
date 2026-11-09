import { Helmet } from 'react-helmet-async';
import { getEnv } from '@/lib/env';
import { SEO_CONFIG, absoluteUrl, clampDescription, pageTitle, type JsonLd } from '@/lib/seo-core';

interface HeadProps {
  /** Page title; omitted on the home page (brand title is used). */
  title?: string;
  description?: string;
  image?: string;
  /** Canonical path ("/annonces"). Query strings are kept only when meaningful (pagination). */
  url?: string;
  /** Prevents indexing (private pages, unavailable listings, filtered duplicates). */
  noindex?: boolean;
  /** schema.org structured data (one object or several). */
  jsonLd?: JsonLd | JsonLd[];
  type?: 'website' | 'article' | 'product';
}

export function Head({ title, description = SEO_CONFIG.description, image, url, noindex, jsonLd, type = 'website' }: HeadProps) {
  const siteUrl = getEnv().appUrl;
  const fullTitle = pageTitle(title);
  const fullUrl = url ? absoluteUrl(siteUrl, url) : undefined;
  const desc = clampDescription(description);
  const ogImage = absoluteUrl(siteUrl, image || SEO_CONFIG.ogImage);
  const blocks = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      {fullUrl && <link rel="canonical" href={fullUrl} />}
      <meta property="og:type" content={type === 'product' ? 'website' : type} />
      <meta property="og:locale" content={SEO_CONFIG.locale} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:site_name" content={SEO_CONFIG.siteName} />
      <meta property="og:image" content={ogImage} />
      {!image && <meta property="og:image:width" content={String(SEO_CONFIG.ogImageWidth)} />}
      {!image && <meta property="og:image:height" content={String(SEO_CONFIG.ogImageHeight)} />}
      {fullUrl && <meta property="og:url" content={fullUrl} />}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={ogImage} />
      {blocks.map((block, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(block)}</script>
      ))}
    </Helmet>
  );
}

/** For private areas (dashboards, auth): never indexed. */
export function NoIndex() {
  return (
    <Helmet>
      <meta name="robots" content="noindex, nofollow" />
    </Helmet>
  );
}
