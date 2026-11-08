import { Helmet } from 'react-helmet-async';

interface HeadProps {
  title: string;
  description?: string;
  image?: string;
  url?: string;
  /** Prevents indexing (sold, expired, unpublished or private pages). */
  noindex?: boolean;
  /** schema.org structured data. */
  jsonLd?: Record<string, unknown>;
  type?: 'website' | 'article' | 'product';
}

const SITE_NAME = 'Ciento-Immobilier';
const DEFAULT_DESCRIPTION = 'Achetez, louez ou vendez des biens immobiliers aux Gonaïves, Artibonite, Haïti. Trouvez la maison, l\'appartement ou le terrain de vos rêves sur Ciento-Immobilier.';

export function Head({ title, description = DEFAULT_DESCRIPTION, image, url, noindex, jsonLd, type = 'website' }: HeadProps) {
  const fullTitle = `${title} — ${SITE_NAME}`;
  const fullUrl = url ? `https://ciento-immobilier.com${url}` : undefined;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      {fullUrl && <link rel="canonical" href={fullUrl} />}
      <meta property="og:type" content={type} />
      <meta property="og:locale" content="fr_HT" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:site_name" content={SITE_NAME} />
      {image && <meta property="og:image" content={image} />}
      {fullUrl && <meta property="og:url" content={fullUrl} />}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      {image && <meta name="twitter:image" content={image} />}
      {jsonLd && <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>}
    </Helmet>
  );
}
