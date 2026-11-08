import { Link } from 'react-router-dom';
import { Building, MapPin, Home as HomeIcon } from 'lucide-react';
import { PageHero } from '@/components/ui/PageHero';
import { Head } from '@/components/seo/Head';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { VerifiedBadge } from '@/components/ui/PromoBadges';
import { usePublicAgencies } from '@/hooks/useMarketplace';

export function Agencies() {
  const { data: agencies, isLoading } = usePublicAgencies();

  return (
    <>
      <Head title="Agences immobilières" description="Les agences immobilières vérifiées présentes sur Ciento-Immobilier." url="/agences" />
      <PageHero
        eyebrow="Professionnels vérifiés"
        icon={Building}
        title="Les agences"
        highlight="de confiance"
        subtitle="Chaque agence est validée par notre équipe avant d’apparaître dans l’annuaire."
        breadcrumbs={[{ label: 'Accueil', to: '/' }, { label: 'Agences' }]}
        actions={<Link to="/tarifs"><Button variant="outlineLight">Vous êtes une agence ?</Button></Link>}
      />
      <div className="bg-gray-50 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {isLoading ? (
            <LoadingSpinner size="lg" className="py-24" />
          ) : agencies && agencies.length > 0 ? (
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {agencies.map((agency) => (
                <li key={agency.id}>
                  <Link to={`/agences/${agency.slug}`} className="flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-6 shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover">
                    <div className="flex items-center gap-4">
                      {agency.logo_url ? (
                        <img src={agency.logo_url} alt="" className="h-14 w-14 rounded-xl object-cover" loading="lazy" />
                      ) : (
                        <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-blue text-lg font-bold text-brand-yellow">{agency.name[0]}</span>
                      )}
                      <div className="min-w-0">
                        <h2 className="truncate font-bold text-primary-900">{agency.name}</h2>
                        <VerifiedBadge />
                      </div>
                    </div>
                    {agency.tagline && <p className="mt-4 line-clamp-2 text-sm text-gray-600">{agency.tagline}</p>}
                    <div className="mt-auto flex items-center gap-4 pt-5 text-xs text-gray-500">
                      {agency.city?.name && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{agency.city.name}</span>}
                      <span className="flex items-center gap-1"><HomeIcon className="h-3.5 w-3.5" />{agency.properties_count} annonce(s)</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<Building className="h-7 w-7" />}
              title="Les premières agences arrivent"
              description="L’annuaire des agences vérifiées sera bientôt disponible."
              className="rounded-2xl bg-white"
            />
          )}
        </div>
      </div>
    </>
  );
}
