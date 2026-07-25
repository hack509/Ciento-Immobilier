import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Phone, Mail, ArrowRight, Send, CheckCircle } from 'lucide-react';
import { useSubscribeNewsletter } from '@/hooks/useNewsletter';

export function Footer() {
  const [email, setEmail] = useState('');
  const { subscribe, isLoading, result } = useSubscribeNewsletter();

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    const res = await subscribe(email);
    if (res.success) setEmail('');
  };

  return (
    <footer className="bg-primary-800 text-white">
      {/* CTA Banner */}
      <div className="bg-secondary-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-2xl font-bold text-white mb-2">
                Vous avez un bien à vendre ou louer ?
              </h3>
              <p className="text-white/80">
                Publiez votre annonce gratuitement et touvez des milliers d&apos;acheteurs potentiels.
              </p>
            </div>
            <Link
              to="/auth/inscription"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-secondary-600 font-semibold rounded-lg hover:bg-gray-50 transition-colors shadow-lg shrink-0"
            >
              Publier une annonce
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Newsletter Banner */}
      <div className="bg-primary-700 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="text-center md:text-left">
              <h3 className="text-xl font-bold text-white mb-2">
                Restez informé des nouvelles annonces
              </h3>
              <p className="text-primary-200 text-sm">
                Recevez les meilleures offres immobilier directement dans votre boîte mail.
              </p>
            </div>
            <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row w-full md:w-auto gap-2">
              <div className="relative flex-1 md:w-72">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Votre adresse email"
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-primary-300 text-sm focus:outline-none focus:ring-2 focus:ring-secondary-400 focus:border-transparent"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-secondary-500 hover:bg-secondary-600 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors shrink-0 text-sm"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                S&apos;abonner
              </button>
            </form>
          </div>
          {result && (
            <div className={`mt-4 flex items-center gap-2 text-sm ${result.success ? 'text-green-300' : 'text-red-300'}`}>
              <CheckCircle className="w-4 h-4" />
              {result.message}
            </div>
          )}
        </div>
      </div>

      {/* Footer Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <Link to="/" className="flex items-center gap-2.5 mb-4">
              <img src="/logo.jpg" alt="Ciento-Immobilier" className="h-10 w-auto rounded-lg object-contain" />
              <div>
                <span className="font-bold text-lg block leading-tight">Ciento</span>
                <span className="text-secondary-400 font-semibold text-[11px] block leading-tight -mt-0.5">Immobilier</span>
              </div>
            </Link>
            <p className="text-primary-300 text-sm leading-relaxed mb-4">
              La première plateforme immobilière des Gonaïves.
              Trouvez votre bien idéal parmi des milliers d&apos;annonces vérifiées.
            </p>
            <div className="flex gap-3">
              <a href="#" className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center hover:bg-secondary-500 transition-colors">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </a>
              <a href="#" className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center hover:bg-secondary-500 transition-colors">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
              </a>
              <a href="#" className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center hover:bg-secondary-500 transition-colors">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold text-white mb-4">Navigation</h3>
            <ul className="space-y-2.5">
              {[
                { to: '/annonces', label: 'Toutes les annonces' },
                { to: '/annonces?listing_type=sale', label: 'Acheter' },
                { to: '/louer', label: 'Louer' },
                { to: '/vendre', label: 'Vendre' },
                { to: '/airbnb', label: 'Airbnb' },
                { to: '/agents', label: 'Agents' },
                { to: '/contact', label: 'Contact' },
              ].map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="text-primary-300 text-sm hover:text-secondary-400 transition-colors flex items-center gap-1.5">
                    <ArrowRight className="w-3 h-3" />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h3 className="font-semibold text-white mb-4">Catégories</h3>
            <ul className="space-y-2.5">
              {[
                { to: '/annonces?property_type=house', label: 'Maisons' },
                { to: '/annonces?property_type=apartment', label: 'Appartements' },
                { to: '/annonces?property_type=land', label: 'Terrains' },
                { to: '/annonces?property_type=commercial', label: 'Locaux Commerciaux' },
                { to: '/annonces?property_type=building', label: 'Immeubles' },
                { to: '/annonces?property_type=villa', label: 'Villas' },
              ].map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="text-primary-300 text-sm hover:text-secondary-400 transition-colors flex items-center gap-1.5">
                    <ArrowRight className="w-3 h-3" />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-semibold text-white mb-4">Contact</h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3 text-primary-300 text-sm">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-secondary-400" />
                <span>Les Gonaïves, Artibonite, Haïti</span>
              </li>
              <li className="flex items-center gap-3 text-primary-300 text-sm">
                <Phone className="w-4 h-4 shrink-0 text-secondary-400" />
                <span>+509 2813-1234</span>
              </li>
              <li className="flex items-center gap-3 text-primary-300 text-sm">
                <Mail className="w-4 h-4 shrink-0 text-secondary-400" />
                <span>info@ciento-immobilier.com</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-primary-400 text-xs">
            &copy; {new Date().getFullYear()} Ciento-Immobilier. Tous droits réservés.
          </p>
          <div className="flex gap-4">
            <Link to="/faq" className="text-primary-400 text-xs hover:text-secondary-400 transition-colors">
              FAQ
            </Link>
            <Link to="/conditions" className="text-primary-400 text-xs hover:text-secondary-400 transition-colors">
              Conditions
            </Link>
            <Link to="/confidentialite" className="text-primary-400 text-xs hover:text-secondary-400 transition-colors">
              Confidentialité
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
