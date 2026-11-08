import { Link } from 'react-router-dom';
import { ArrowRight, Briefcase, PhoneCall, FileCheck2, Users } from 'lucide-react';
import { PageHero } from '@/components/ui/PageHero';
import { Head } from '@/components/seo/Head';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ServiceIcon } from '@/components/services/ServiceIcon';
import { useServiceCategories } from '@/hooks/useMarketplace';
import { formatPrice } from '@/lib/utils';

const PROCESS = [
  { icon: FileCheck2, title: 'Votre demande', desc: 'Décrivez votre projet en quelques lignes, sans engagement.' },
  { icon: PhoneCall, title: 'Prise de contact', desc: 'Un conseiller vous rappelle pour préciser vos besoins et le devis.' },
  { icon: Users, title: 'Accompagnement', desc: 'Nos experts locaux vous suivent jusqu’à la réussite du projet.' },
];

export function Services() {
  const { data: services, isLoading } = useServiceCategories();

  return (
    <>
      <Head
        title="Services immobiliers"
        description="Estimation, évaluation, accompagnement à l'achat et à la vente, gestion locative et conseil immobilier en Haïti."
        url="/services"
      />
      <PageHero
        eyebrow="Services immobiliers"
        icon={Briefcase}
        title="Des experts à vos côtés,"
        highlight="à chaque étape"
        subtitle="Estimation, évaluation, achat, vente, gestion locative : l’équipe Ciento-Immobilier vous accompagne avec rigueur et une connaissance fine du marché haïtien."
        breadcrumbs={[{ label: 'Accueil', to: '/' }, { label: 'Services' }]}
        actions={
          <a href="#services-list">
            <Button size="lg">Découvrir nos services</Button>
          </a>
        }
        size="lg"
      />

      <section id="services-list" className="bg-gray-50 py-14 sm:py-20" aria-labelledby="services-title">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="eyebrow mb-2">Nos prestations</p>
          <h2 id="services-title" className="mb-10 text-2xl font-bold text-primary-900 sm:text-3xl">Choisissez votre accompagnement</h2>
          {isLoading ? (
            <LoadingSpinner size="lg" className="py-20" />
          ) : (
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {(services || []).map((service) => (
                <li key={service.id}>
                  <Link
                    to={`/services/${service.slug}`}
                    className="group flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-6 shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover"
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-blue text-brand-yellow">
                      <ServiceIcon name={service.icon} className="h-6 w-6" />
                    </span>
                    <h3 className="mt-5 text-lg font-bold text-primary-900">{service.name}</h3>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-gray-600">{service.short_description}</p>
                    <span className="mt-5 flex items-center justify-between text-sm font-semibold text-brand-blue">
                      {service.starting_price ? `À partir de ${formatPrice(service.starting_price, service.currency)}` : 'Sur devis'}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="bg-white py-14 sm:py-20" aria-labelledby="process-title">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 id="process-title" className="mb-10 text-2xl font-bold text-primary-900 sm:text-3xl">Comment ça se passe ?</h2>
          <ol className="grid gap-6 md:grid-cols-3">
            {PROCESS.map(({ icon: Icon, title, desc }, i) => (
              <li key={title} className="relative rounded-2xl border border-gray-100 p-6 shadow-card">
                <span aria-hidden="true" className="absolute right-6 top-6 font-display text-5xl font-extrabold text-primary-50">{i + 1}</span>
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary-50 text-secondary-700"><Icon className="h-5 w-5" /></span>
                <h3 className="mt-4 font-bold text-primary-900">{title}</h3>
                <p className="mt-1 text-sm text-gray-600">{desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
