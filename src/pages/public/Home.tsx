import { Link } from 'react-router-dom';
import {
  ArrowRight, Home as HomeIcon, Building2, Store, Mountain, Castle, Landmark,
  ShieldCheck, MapPinned, Headset, Search, MessageSquare, KeyRound, CheckCircle2, Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PropertyCard } from '@/components/ui/PropertyCard';
import { PropertyCardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Head } from '@/components/seo/Head';
import { HeroSearch } from '@/components/home/HeroSearch';
import { useFeaturedProperties } from '@/hooks/useProperties';
import { PROPERTY_TYPES } from '@/lib/constants';

const typeIcons: Record<(typeof PROPERTY_TYPES)[number]['value'], typeof HomeIcon> = {
  house: HomeIcon,
  apartment: Building2,
  land: Mountain,
  commercial: Store,
  building: Landmark,
  villa: Castle,
};

const TRUST_POINTS = [
  { icon: ShieldCheck, title: 'Annonces vérifiées', desc: 'Contrôlées avant publication' },
  { icon: MapPinned, title: 'Experts locaux', desc: 'Ancrés aux Gonaïves' },
  { icon: Headset, title: 'Accompagnement', desc: 'De la visite à la signature' },
];

const STEPS = [
  { icon: Search, title: 'Recherchez', desc: 'Filtrez par ville, type de bien et budget pour trouver les annonces qui vous correspondent.' },
  { icon: MessageSquare, title: 'Échangez', desc: 'Contactez directement le propriétaire ou l’agent depuis l’annonce et organisez une visite.' },
  { icon: KeyRound, title: 'Concluez', desc: 'Finalisez en confiance avec un interlocuteur identifié et des conseils adaptés au marché haïtien.' },
];

const OWNER_BENEFITS = [
  'Publication gratuite de vos annonces',
  'Messagerie intégrée avec les acheteurs et locataires',
  'Tableau de bord pour suivre vos biens',
  'Photos, prix en HTG ou USD, mise en avant',
];

function SectionHeading({ eyebrow, title, subtitle, action }: {
  eyebrow: string; title: string; subtitle?: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8 lg:mb-10">
      <div>
        <p className="eyebrow mb-2">{eyebrow}</p>
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary-900">{title}</h2>
        {subtitle && <p className="text-gray-500 mt-2 max-w-xl">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Home() {
  const { data: featuredProperties, isLoading: isLoadingFeatured } = useFeaturedProperties(6);

  return (
    <div>
      <Head
        title="Accueil"
        description="Achetez, louez ou vendez des biens immobiliers aux Gonaïves, Artibonite, Haïti. La première plateforme immobilière des Gonaïves."
      />

      {/* Hero */}
      <section className="relative bg-primary-900 overflow-hidden">
        <picture>
          <source media="(max-width: 767px)" srcSet="/hero-sm.webp" type="image/webp" />
          <img
            src="/hero.webp"
            alt=""
            aria-hidden="true"
            fetchPriority="high"
            className="absolute inset-0 h-full w-full object-cover object-[70%_center]"
          />
        </picture>
        {/* Full-bleed background: navy from the left keeps the text readable, the house stays visible on the right */}
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-primary-900/95 via-primary-900/75 to-primary-900/10" />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-primary-900/70 via-transparent to-primary-900/30" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-16 sm:pt-20 sm:pb-24 lg:py-28">
          <div className="max-w-2xl animate-fade-up">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-secondary-300 ring-1 ring-inset ring-white/15 mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-secondary-400" />
              Immobilier aux Gonaïves et partout en Haïti
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold text-white leading-[1.05]">
              Trouvez le bien <span className="text-secondary-400">qui vous ressemble</span>
            </h1>
            <p className="mt-5 text-base sm:text-lg text-primary-200 leading-relaxed max-w-lg">
              Maisons, appartements, terrains et locaux commerciaux, présentés
              par des propriétaires et des agents de confiance.
            </p>
          </div>

          <div className="mt-10 animate-fade-up [animation-delay:120ms]">
            <HeroSearch />
          </div>

          <ul className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl">
            {TRUST_POINTS.map(({ icon: Icon, title, desc }) => (
              <li key={title} className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-inset ring-white/15">
                  <Icon className="h-5 w-5 text-secondary-400" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-white">{title}</span>
                  <span className="block text-xs text-primary-300">{desc}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Property types */}
      <section aria-labelledby="types-title" className="border-b border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h2 id="types-title" className="sr-only">Parcourir par type de bien</h2>
          <ul className="flex lg:grid lg:grid-cols-6 gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4 lg:mx-0 lg:px-0 snap-x">
            {PROPERTY_TYPES.map(({ value, label }, i) => {
              const Icon = typeIcons[value];
              const gold = i % 2 === 0;
              return (
                <li key={value} className="snap-start shrink-0">
                  <Link
                    to={`/annonces?property_type=${value}`}
                    className="group flex items-center gap-3 rounded-2xl px-3 py-3 pr-5 hover:bg-gray-50 transition-colors min-h-[44px]"
                  >
                    <span className={gold
                      ? 'flex h-12 w-12 items-center justify-center rounded-full bg-secondary-500 text-primary-900 transition-transform group-hover:scale-105'
                      : 'flex h-12 w-12 items-center justify-center rounded-full bg-primary-800 text-white transition-transform group-hover:scale-105'}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-sm font-semibold text-primary-900 whitespace-nowrap">{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Featured */}
      <section className="py-16 lg:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Sélection"
            title="Biens en vedette"
            subtitle="Une sélection des meilleures offres du moment."
            action={
              <Link to="/annonces" className="shrink-0">
                <Button variant="outline">
                  Voir toutes les annonces
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            }
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {isLoadingFeatured ? (
              Array.from({ length: 3 }).map((_, i) => <PropertyCardSkeleton key={i} />)
            ) : featuredProperties && featuredProperties.length > 0 ? (
              featuredProperties.map((property) => <PropertyCard key={property.id} property={property} />)
            ) : (
              <EmptyState
                icon={<HomeIcon className="w-7 h-7" />}
                title="Les premières annonces arrivent"
                description="Notre sélection est en cours de préparation. Parcourez toutes les annonces disponibles en attendant."
                action={<Link to="/annonces"><Button>Parcourir les annonces</Button></Link>}
                className="col-span-full rounded-2xl border border-dashed border-gray-200 bg-white"
              />
            )}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading eyebrow="Simple et sûr" title="Comment ça marche" />
          <ol className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STEPS.map(({ icon: Icon, title, desc }, i) => (
              <li key={title} className="relative rounded-2xl border border-gray-100 bg-white p-6 lg:p-8 shadow-card">
                <span className="absolute top-6 right-6 font-display text-5xl font-extrabold text-primary-50 select-none" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary-50 text-secondary-700 mb-5">
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="text-lg font-bold text-primary-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Owners & agents */}
      <section className="pb-16 lg:pb-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-primary-900 px-6 py-12 sm:px-12 lg:px-16 lg:py-16">
            <div aria-hidden="true" className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-secondary-500/10" />
            <div aria-hidden="true" className="absolute -right-10 bottom-0 h-40 w-40 rounded-full bg-secondary-500/10" />
            <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
              <div>
                <p className="eyebrow !text-secondary-400 mb-3">Propriétaires & agents</p>
                <h2 className="text-3xl lg:text-4xl font-bold text-white">
                  Vendez ou louez votre bien plus rapidement
                </h2>
                <p className="mt-4 text-primary-200 leading-relaxed max-w-lg">
                  Publiez votre annonce en quelques minutes et recevez les demandes
                  des acheteurs et locataires directement dans votre messagerie.
                </p>
                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  <Link to="/dashboard/annonces/nouvelle">
                    <Button size="lg" icon={<Plus className="w-4 h-4" />}>Publier une annonce</Button>
                  </Link>
                  <Link to="/contact">
                    <Button size="lg" variant="outlineLight">
                      Parler à un conseiller
                    </Button>
                  </Link>
                </div>
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {OWNER_BENEFITS.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-3 rounded-2xl bg-white/5 p-4 ring-1 ring-inset ring-white/10">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-secondary-400 mt-0.5" />
                    <span className="text-sm text-primary-100">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
