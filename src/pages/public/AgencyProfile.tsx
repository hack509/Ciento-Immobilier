import { Link, useParams } from 'react-router-dom';
import { Globe, Mail, MapPin, Phone, MessageCircle, Building } from 'lucide-react';
import { Head } from '@/components/seo/Head';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { PropertyCard } from '@/components/ui/PropertyCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { VerifiedBadge } from '@/components/ui/PromoBadges';
import { usePublicAgency, usePublicAgencyDetails } from '@/hooks/useMarketplace';

export function AgencyProfile() {
  const { slug } = useParams<{ slug: string }>();
  const { data: agency, isLoading } = usePublicAgency(slug);
  const { team, listings } = usePublicAgencyDetails(agency?.id);

  if (isLoading) return <LoadingSpinner size="lg" className="py-40" text="Chargement de l’agence…" />;
  if (!agency) {
    return (
      <div className="py-32 text-center">
        <Head title="Agence introuvable" noindex />
        <h1 className="text-2xl font-bold text-primary-900">Agence introuvable</h1>
        <Link to="/agences" className="mt-6 inline-block"><Button>Voir les agences</Button></Link>
      </div>
    );
  }

  // Enterprise agencies may set their own accent colour (validated hex in the database).
  const accent = agency.brand_color || '#1D3E91';
  const whatsapp = agency.whatsapp?.replace(/[^\d]/g, '');

  return (
    <>
      <Head
        title={agency.name}
        description={agency.tagline || agency.description?.slice(0, 155) || `${agency.name}, agence immobilière en Haïti.`}
        image={agency.logo_url || undefined}
        url={`/agences/${agency.slug}`}
        noindex={!agency.is_verified}
        jsonLd={agency.is_verified ? {
          '@context': 'https://schema.org',
          '@type': 'RealEstateAgent',
          name: agency.name,
          logo: agency.logo_url || undefined,
          telephone: agency.phone,
          email: agency.email || undefined,
          url: agency.website && /^https?:\/\//i.test(agency.website) ? agency.website : undefined,
          address: { '@type': 'PostalAddress', streetAddress: agency.address || undefined, addressLocality: agency.city?.name, addressCountry: 'HT' },
        } : undefined}
      />

      <section className="relative isolate overflow-hidden bg-primary-900">
        {agency.cover_url ? (
          <img src={agency.cover_url} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-30" />
        ) : null}
        <div aria-hidden="true" className="absolute inset-0" style={{ background: `linear-gradient(120deg, ${accent} 0%, rgb(10 22 40 / 0.92) 70%)` }} />
        <div aria-hidden="true" className="hero-grid absolute inset-0" />
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 bg-brand-yellow" />
        <div className="relative mx-auto flex max-w-7xl flex-col gap-6 px-4 py-12 sm:flex-row sm:items-center sm:px-6 sm:py-16 lg:px-8">
          {agency.logo_url ? (
            <img src={agency.logo_url} alt={agency.name} className="h-24 w-24 rounded-2xl bg-white object-contain p-2 shadow-float" />
          ) : (
            <span className="flex h-24 w-24 items-center justify-center rounded-2xl bg-white text-3xl font-extrabold text-brand-blue shadow-float">{agency.name[0]}</span>
          )}
          <div className="min-w-0 flex-1">
            <nav aria-label="Fil d’Ariane" className="mb-2 text-xs text-primary-200">
              <Link to="/agences" className="hover:text-white">Agences</Link> / <span className="text-white">{agency.name}</span>
            </nav>
            <h1 className="text-3xl font-extrabold text-white sm:text-4xl">{agency.name}</h1>
            {agency.tagline && <p className="mt-2 max-w-2xl text-primary-100">{agency.tagline}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-primary-100">
              {agency.is_verified && <VerifiedBadge label="Agence vérifiée" />}
              {agency.city?.name && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{agency.city.name}</span>}
              <span>{agency.properties_count} annonce(s)</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:w-56">
            <a href={`tel:${agency.phone}`}><Button className="w-full" icon={<Phone className="h-4 w-4" />}>Appeler</Button></a>
            {whatsapp && (
              <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer">
                <Button variant="outlineLight" className="w-full" icon={<MessageCircle className="h-4 w-4" />}>WhatsApp</Button>
              </a>
            )}
          </div>
        </div>
      </section>

      <div className="bg-gray-50 py-12">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-3 lg:px-8">
          <div className="space-y-8 lg:col-span-2">
            {agency.description && (
              <section className="rounded-2xl bg-white p-6 shadow-card">
                <h2 className="mb-3 text-lg font-bold text-primary-900">À propos</h2>
                <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">{agency.description}</p>
              </section>
            )}

            <section aria-labelledby="listings-title">
              <h2 id="listings-title" className="mb-4 text-xl font-bold text-primary-900">Annonces de l’agence</h2>
              {listings.isLoading ? (
                <LoadingSpinner className="py-16" />
              ) : listings.data && listings.data.length > 0 ? (
                <div className="grid gap-5 sm:grid-cols-2">
                  {listings.data.map((p) => <PropertyCard key={p.id} property={p} />)}
                </div>
              ) : (
                <EmptyState icon={<Building className="h-7 w-7" />} title="Aucune annonce en ligne" className="rounded-2xl bg-white" />
              )}
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-2xl bg-white p-6 shadow-card">
              <h2 className="mb-4 text-lg font-bold text-primary-900">Coordonnées</h2>
              <ul className="space-y-3 text-sm text-gray-700">
                <li className="flex gap-2"><Phone className="h-4 w-4 text-brand-blue" /><a href={`tel:${agency.phone}`}>{agency.phone}</a></li>
                {agency.email && <li className="flex gap-2"><Mail className="h-4 w-4 text-brand-blue" /><a href={`mailto:${agency.email}`} className="break-all">{agency.email}</a></li>}
                {agency.website && /^https?:\/\//i.test(agency.website) && (
                  <li className="flex gap-2"><Globe className="h-4 w-4 text-brand-blue" />
                    <a href={agency.website} target="_blank" rel="noopener noreferrer nofollow" className="break-all">{agency.website.replace(/^https?:\/\//, '')}</a>
                  </li>
                )}
                {agency.address && <li className="flex gap-2"><MapPin className="h-4 w-4 text-brand-blue" />{agency.address}</li>}
              </ul>
            </section>

            {team.data && team.data.length > 0 && (
              <section className="rounded-2xl bg-white p-6 shadow-card">
                <h2 className="mb-1 text-lg font-bold text-primary-900">L’équipe</h2>
                {agency.team_intro && <p className="mb-4 text-sm text-gray-500">{agency.team_intro}</p>}
                <ul className="space-y-3">
                  {team.data.map((m) => (
                    <li key={m.id} className="flex items-center gap-3">
                      {m.avatar_url ? (
                        <img src={m.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-800">{m.first_name[0]}{m.last_name[0]}</span>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-primary-900">{m.first_name} {m.last_name}</p>
                        <p className="text-xs text-gray-500">{m.title || (m.member_role === 'manager' ? 'Gestionnaire' : 'Agent immobilier')}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}
