import { Link } from 'react-router-dom';
import { Tag, UserPlus, Camera, Handshake, ArrowRight, TrendingUp, Shield, Headphones, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PropertyCard } from '@/components/ui/PropertyCard';
import { PropertyCardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useProperties } from '@/hooks/useProperties';

const steps = [
  {
    icon: UserPlus,
    title: 'Créez votre compte',
    description: 'Inscrivez-vous gratuitement en quelques secondes pour commencer à publier vos annonces.',
  },
  {
    icon: Camera,
    title: 'Publiez votre annonce',
    description: 'Ajoutez des photos, décrivez votre bien et fixez un prix. Votre annonce est en ligne immédiatement.',
  },
  {
    icon: Handshake,
    title: 'Recevez les offres',
    description: 'Recevez des messages et appels d\'acheteurs potentiels intéressés par votre bien.',
  },
];

const advantages = [
  {
    icon: TrendingUp,
    title: 'Grande visibilité',
    description: 'Des milliers d\'acheteurs et locataires consultent notre plateforme chaque jour.',
  },
  {
    icon: Shield,
    title: 'Annonces vérifiées',
    description: 'Chaque annonce est validée par notre équipe pour garantir la confiance.',
  },
  {
    icon: CheckCircle,
    title: '100% gratuit',
    description: 'La publication d\'annonces est entièrement gratuite pour tous les utilisateurs.',
  },
  {
    icon: Headphones,
    title: 'Support dédié',
    description: 'Notre équipe est disponible pour vous accompagner à chaque étape.',
  },
];

export function Sell() {
  const { data, isLoading } = useProperties({
    listing_type: 'sale',
    per_page: 6,
  });

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Hero */}
      <div className="bg-gradient-to-r from-primary-700 to-primary-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Tag className="w-6 h-6 text-white" />
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mb-4">
            Vendez votre bien<br />
            <span className="text-secondary-400">rapidement et en confiance</span>
          </h1>
          <p className="text-lg text-white/80 mb-8 max-w-xl leading-relaxed">
            Publiez votre annonce gratuitement sur la plateforme immobilière
            n°1 aux Gonaïves et touvez l&apos;acheteur idéal.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link to="/auth/inscription">
              <Button size="lg" className="bg-secondary-500 hover:bg-secondary-600 text-white font-semibold">
                Publier une annonce
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link to="/annonces?listing_type=sale">
              <Button variant="outline" size="lg" className="border-white/30 text-white hover:bg-white/10">
                Voir les annonces à vendre
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Steps */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-primary-800 mb-3">Comment ça marche ?</h2>
            <p className="text-gray-500">Vendez votre bien en 3 étapes simples</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="text-center">
                  <div className="w-16 h-16 bg-secondary-50 rounded-2xl flex items-center justify-center mx-auto mb-4 relative">
                    <Icon className="w-8 h-8 text-secondary-500" />
                    <span className="absolute -top-2 -right-2 w-7 h-7 bg-primary-700 text-white text-sm font-bold rounded-full flex items-center justify-center">
                      {i + 1}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{step.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{step.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Advantages */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-primary-800 mb-3">Pourquoi Ciento-Immobilier ?</h2>
            <p className="text-gray-500">Les avantages de vendre sur notre plateforme</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {advantages.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="bg-gray-50 rounded-xl p-6 text-center">
                  <div className="w-12 h-12 bg-secondary-50 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <Icon className="w-6 h-6 text-secondary-500" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{item.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Recent Sale Listings */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-3xl font-bold text-primary-800 mb-2">Annonces récentes à vendre</h2>
              <p className="text-gray-500">Découvrez ce que les autres vendent en ce moment</p>
            </div>
            <Link to="/annonces?listing_type=sale" className="hidden sm:flex items-center gap-1 text-secondary-600 font-semibold hover:text-secondary-700">
              Voir toutes <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <PropertyCardSkeleton key={i} />
              ))
            ) : data?.data && data.data.length > 0 ? (
              data.data.map((property) => (
                <PropertyCard key={property.id} property={property} />
              ))
            ) : (
              <EmptyState
                title="Aucune annonce disponible"
                description="Soyez le premier à publier une annonce à vendre."
                className="col-span-full"
              />
            )}
          </div>
          <div className="text-center mt-8 sm:hidden">
            <Link to="/annonces?listing_type=sale">
              <Button variant="outline" className="border-secondary-500 text-secondary-600 hover:bg-secondary-50">
                Voir toutes les annonces
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 bg-primary-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Prêt à vendre votre bien ?
          </h2>
          <p className="text-primary-200 mb-8 max-w-xl mx-auto">
            Rejoignez des milliers de propriétaires qui ont vendu leur bien grâce à Ciento-Immobilier.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/auth/inscription">
              <Button size="lg" className="bg-secondary-500 hover:bg-secondary-600 text-white font-semibold">
                Commencer maintenant
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link to="/contact">
              <Button variant="outline" size="lg" className="border-white/30 text-white hover:bg-white/10">
                Nous contacter
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
