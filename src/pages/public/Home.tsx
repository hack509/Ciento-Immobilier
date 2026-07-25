import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, MapPin, Home as HomeIcon, Building2, Store, ArrowRight, Shield, Clock, Star, Mountain, Castle, TrendingUp, Users, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PropertyCard } from '@/components/ui/PropertyCard';
import { PropertyCardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useFeaturedProperties } from '@/hooks/useProperties';
import { useCategories } from '@/hooks/useCategories';

const HERO_IMAGE = '/hero.png';

const categoryIcons: Record<string, typeof HomeIcon> = {
  maison: HomeIcon,
  appartement: Building2,
  terrain: Mountain,
  'local-commercial': Store,
  immeuble: Building2,
  villa: Castle,
};

export function Home() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [heroImageError, setHeroImageError] = useState(false);
  const { data: featuredProperties, isLoading: isLoadingFeatured } = useFeaturedProperties(6);
  const { data: categoriesData } = useCategories();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/annonces?q=${encodeURIComponent(searchQuery)}`);
  };

  const showHeroImage = !heroImageError;

  return (
    <div>
      {/* Hero — Cinematic real-estate hero with image background */}
      <section className="relative min-h-[500px] sm:min-h-[600px] lg:min-h-[720px] overflow-hidden">
        {/* Background Image */}
        {showHeroImage && (
          <img
            src={HERO_IMAGE}
            alt=""
            aria-hidden="true"
            onError={() => setHeroImageError(true)}
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
        )}

        {/* Gradient Fallback — shown when image is missing or fails */}
        {showHeroImage && (
          <div className="absolute inset-0 bg-gradient-to-br from-primary-900 via-primary-800 to-primary-900 -z-10" />
        )}
        {!showHeroImage && (
          <div className="absolute inset-0 bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700">
            <div className="absolute inset-0 opacity-[0.07]">
              <div className="absolute top-20 left-10 w-72 h-72 bg-secondary-400 rounded-full blur-3xl" />
              <div className="absolute bottom-10 right-20 w-96 h-96 bg-primary-400 rounded-full blur-3xl" />
            </div>
          </div>
        )}

        {/* Overlays — cinematic readability gradients */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary-900/90 via-primary-900/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-primary-900/50 via-transparent to-primary-900/20" />

        {/* Content — left-aligned for hero text */}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20 lg:py-32 min-h-[500px] sm:min-h-[600px] lg:min-h-[720px] flex items-center">
          <div className="max-w-2xl">
            <Badge variant="primary" className="mb-5 bg-secondary-500/20 text-secondary-300 border border-secondary-500/30 backdrop-blur-sm">
              Immobilier en Haïti
            </Badge>
            <h1 className="text-3xl sm:text-4xl lg:text-6xl font-bold text-primary-200 leading-[1.1] mb-4 sm:mb-6 drop-shadow-lg">
              Trouvez{' '}
              <span className="text-secondary-400">le bien immobilier</span>{' '}
              qui vous correspond, partout en Haïti
            </h1>
            <p className="text-lg lg:text-xl text-white/80 mb-10 max-w-xl leading-relaxed drop-shadow">
              Achetez, louez ou vendez des maisons, appartements, terrains
              et locaux commerciaux en toute sécurité sur une plateforme
              moderne et fiable.
            </p>

            {/* Search Bar — Zillow-style elevated */}
            <form onSubmit={handleSearch} className="bg-white rounded-2xl p-2 shadow-2xl max-w-2xl">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher par quartier, ville, type de bien..."
                    className="w-full pl-10 pr-4 py-3.5 rounded-xl border-0 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-secondary-400"
                  />
                </div>
                <Button size="lg" className="sm:w-auto bg-secondary-500 hover:bg-secondary-600 text-white font-semibold">
                  <Search className="w-4 h-4" />
                  Rechercher
                </Button>
              </div>
            </form>

            <div className="flex flex-wrap gap-3 mt-6">
              <span className="text-white/50 text-sm">Populaire :</span>
              {['Maison Gonaïves', 'Terrain Artibonite', 'Villa', 'Appartement'].map((tag) => (
                <Link
                  key={tag}
                  to={`/annonces?q=${tag}`}
                  className="text-sm text-white/50 hover:text-secondary-400 transition-colors"
                >
                  {tag}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats Strip */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: TrendingUp, value: '2,500+', label: 'Annonces actives' },
              { icon: Users, value: '150+', label: 'Agents vérifiés' },
              { icon: Building2, value: '50+', label: 'Agences partenaires' },
              { icon: Star, value: '10,000+', label: 'Utilisateurs satisfaits' },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="text-center">
                  <div className="w-10 h-10 bg-secondary-50 rounded-lg flex items-center justify-center mx-auto mb-2">
                    <Icon className="w-5 h-5 text-secondary-500" />
                  </div>
                  <div className="text-2xl lg:text-3xl font-bold text-primary-800">{stat.value}</div>
                  <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Categories — Zillow-style grid */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-primary-800 mb-3">Explorer par catégorie</h2>
            <p className="text-gray-500">Trouvez le bien qui correspond à vos besoins</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {(categoriesData || []).map((cat) => {
              const Icon = categoryIcons[cat.slug] || HomeIcon;
              return (
                <Link key={cat.slug} to={`/annonces?property_type=${cat.slug}`}>
                  <Card hover className="text-center p-6 group">
                    <div className="w-14 h-14 bg-secondary-50 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:bg-secondary-100 transition-colors">
                      <Icon className="w-7 h-7 text-secondary-500" />
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1">{cat.name}</h3>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Featured Properties */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-3xl font-bold text-primary-800 mb-2">Annonces en vedette</h2>
              <p className="text-gray-500">Les meilleures offres du moment</p>
            </div>
            <Link to="/annonces" className="hidden sm:flex items-center gap-1 text-secondary-600 font-semibold hover:text-secondary-700">
              Voir toutes <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {isLoadingFeatured ? (
              Array.from({ length: 3 }).map((_, i) => (
                <PropertyCardSkeleton key={i} />
              ))
            ) : featuredProperties && featuredProperties.length > 0 ? (
              featuredProperties.map((property) => (
                <PropertyCard key={property.id} property={property} />
              ))
            ) : (
              <EmptyState
                title="Aucune annonce en vedette"
                description="Revenez bientôt pour découvrir nos annonces phares."
                className="col-span-full"
              />
            )}
          </div>
          <div className="text-center mt-8 sm:hidden">
            <Link to="/annonces">
              <Button variant="outline" className="border-secondary-500 text-secondary-600 hover:bg-secondary-50">
                Voir toutes les annonces
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Professional CTA Section */}
      <section className="py-16 bg-primary-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge variant="primary" className="mb-4 bg-secondary-500/20 text-secondary-300 border border-secondary-500/30">
                Propriétaires & Agents
              </Badge>
              <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
                Boostez vos ventes avec Ciento-Immobilier
              </h2>
              <p className="text-primary-200 text-lg mb-8 leading-relaxed">
                Rejoignez la plateforme immobilière n°1 aux Gonaïves.
                Publiez vos annonces, touvez des acheteurs qualifiés et
                gérez vos transactions en toute simplicité.
              </p>
              <div className="space-y-4 mb-8">
                {[
                  'Publication gratuite et illimitée',
                  'Visibilité sur des milliers d&apos;acheteurs',
                  'Outils de gestion avancés',
                  'Support client dédié',
                ].map((feature) => (
                  <div key={feature} className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-secondary-400 shrink-0" />
                    <span className="text-secondary-100">{feature}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
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

            {/* Trust Indicators */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Shield, title: 'Annonces vérifiées', desc: 'Chaque annonce est validée par notre équipe' },
                { icon: Clock, title: 'Réponse rapide', desc: 'Contactez les agents en temps réel' },
                { icon: Star, title: 'Service premium', desc: 'Accompagnement personnalisé' },
                { icon: TrendingUp, title: 'Résultats garantis', desc: '95% de satisfaction client' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="bg-white/10 backdrop-blur-sm rounded-xl p-5">
                    <div className="w-10 h-10 bg-secondary-500/20 rounded-lg flex items-center justify-center mb-3">
                      <Icon className="w-5 h-5 text-secondary-400" />
                    </div>
                    <h3 className="font-semibold text-white mb-1">{item.title}</h3>
                    <p className="text-primary-300 text-sm">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-primary-800 mb-4">
            Prêt à trouver votre bien ?
          </h2>
          <p className="text-gray-500 mb-8 max-w-xl mx-auto">
            Parcourez des milliers d&apos;annonces vérifiées aux Gonaïves et trouvez la maison de vos rêves.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/annonces">
              <Button size="lg" className="bg-primary-700 hover:bg-primary-800 text-white font-semibold">
                Explorer les annonces
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link to="/auth/inscription">
              <Button variant="outline" size="lg" className="border-secondary-500 text-secondary-600 hover:bg-secondary-50">
                <MapPin className="w-4 h-4" />
                Créer un compte
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
