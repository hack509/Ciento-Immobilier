import { Navigate, useParams } from 'react-router-dom';
import { useProperty } from '@/hooks/useProperty';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { NotFound } from './NotFound';
import { generatePropertyUrl } from '@/lib/utils';

/**
 * Short shareable URL /propriete/:slug → canonical /annonces/:city/:slug
 * (a single canonical URL per listing avoids duplicate content).
 */
export function PropertyAlias() {
  const { slug } = useParams<{ slug: string }>();
  const { data: property, isLoading } = useProperty(slug || '');
  if (isLoading) return <LoadingSpinner size="lg" className="py-32" />;
  if (!property) return <NotFound />;
  return <Navigate to={generatePropertyUrl(property as { slug: string; city?: { slug: string } })} replace />;
}
