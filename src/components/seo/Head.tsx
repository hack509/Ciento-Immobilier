import { Helmet } from 'react-helmet-async';

interface HeadProps {
  title: string;
  description?: string;
  image?: string;
  url?: string;
}

const SITE_NAME = 'Ciento-Immobilier';
const DEFAULT_DESCRIPTION = 'Achetez, louez ou vendez des biens immobiliers aux Gonaïves, Artibonite, Haïti. Trouvez la maison, l\'appartement ou le terrain de vos rêves sur Ciento-Immobilier.';

export function Head({ title, description = DEFAULT_DESCRIPTION, image, url }: HeadProps) {
  const fullTitle = `${title} — ${SITE_NAME}`;
  const fullUrl = url ? `https://ciento-immobilier.com${url}` : undefined;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:site_name" content={SITE_NAME} />
      {image && <meta property="og:image" content={image} />}
      {fullUrl && <meta property="og:url" content={fullUrl} />}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      {image && <meta name="twitter:image" content={image} />}
    </Helmet>
  );
}
