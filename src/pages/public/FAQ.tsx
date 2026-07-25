import { useState, useRef, useEffect } from 'react';
import { HelpCircle, ChevronDown, Search, Mail, Phone, MapPin } from 'lucide-react';

const faqSections = [
  {
    title: 'Général',
    questions: [
      {
        q: 'Qu\'est-ce que Ciento-Immobilier ?',
        a: 'Ciento-Immobilier est la première plateforme immobilière digitale des Gonaïves et de tout Haïti. Elle met en relation les acheteurs, locataires, vendeurs et agents immobiliers pour faciliter les transactions immobilières en toute sécurité et transparence.',
      },
      {
        q: 'Ciento-Immobilier est-il gratuit ?',
        a: 'Oui, la consultation des annonces et la recherche de biens sont entièrement gratuites. La publication d\'annonces est également gratuite pour les particuliers. Des fonctionnalités premium peuvent être proposées aux agents et agences professionnelles.',
      },
      {
        q: 'Dans quelles villes Ciento-Immobilier est-il disponible ?',
        a: 'Ciento-Immobilier couvre l\'ensemble du territoire haïtien, avec une présence forte aux Gonaïves, Port-au-Prince, Cap-Haïtien, Les Cayes, Jacmel et dans toutes les grandes villes du pays.',
      },
    ],
  },
  {
    title: 'Compte',
    questions: [
      {
        q: 'Comment créer un compte ?',
        a: 'Cliquez sur "S\'inscrire" en haut à droite de la page d\'accueil. Remplissez le formulaire avec vos informations (nom, prénom, email, téléphone, mot de passe) et validez. Vous recevrez un email de confirmation pour activer votre compte.',
      },
      {
        q: 'J\'ai oublié mon mot de passe, comment faire ?',
        a: 'Sur la page de connexion, cliquez sur "Mot de passe oublié". Saisissez votre adresse email et vous recevrez un lien de réinitialisation valable pendant 24 heures. Suivez les instructions dans l\'email pour créer un nouveau mot de passe.',
      },
      {
        q: 'Comment modifier mon profil ?',
        a: 'Connectez-vous à votre compte, allez dans "Tableau de bord" puis "Profil". Vous pouvez y modifier votre nom, photo, bio, téléphone et préférences. N\'oubliez pas de sauvegarder vos modifications.',
      },
      {
        q: 'Comment supprimer mon compte ?',
        a: 'Allez dans "Tableau de bord" puis "Paramètres". Cliquez sur "Supprimer mon compte" et confirmez votre choix. Attention, cette action est irréversible et toutes vos données seront définitivement effacées.',
      },
    ],
  },
  {
    title: 'Annonces',
    questions: [
      {
        q: 'Comment publier une annonce ?',
        a: 'Connectez-vous à votre compte, allez dans "Tableau de bord" puis "Nouvelle annonce". Remplissez le formulaire avec les détails de votre bien (type, localisation, prix, surface, photos, description). Votre annonce sera publiée immédiatement après validation.',
      },
      {
        q: 'Puis-je modifier ou supprimer mon annonce ?',
        a: 'Oui, depuis "Tableau de bord" > "Mes annonces", vous pouvez modifier tous les détails de votre annonce ou la supprimer définitivement en cliquant sur l\'icône correspondante.',
      },
      {
        q: 'Combien de photos puis-je ajouter ?',
        a: 'Vous pouvez ajouter jusqu\'à 15 photos par annonce. Nous recommandons d\'ajouter au moins 5 photos de bonne qualité pour attirer plus d\'acheteurs potentiels. Les formats acceptés sont JPEG, PNG et WebP.',
      },
      {
        q: 'Pourquoi mon annonce a-t-elle été rejetée ?',
        a: 'Les annonces peuvent être rejetées si elles ne respectent pas nos conditions d\'utilisation : photos inappropriées, informations inexactes, prix fantaisiste, ou contenus discriminatoires. Vous recevrez un email expliquant le motif du rejet.',
      },
    ],
  },
  {
    title: 'Recherche',
    questions: [
      {
        q: 'Comment rechercher un bien ?',
        a: 'Utilisez la barre de recherche sur la page d\'accueil ou la page "Annonces". Vous pouvez filtrer par ville, quartier, type de bien (maison, appartement, terrain, etc.), prix, surface et nombre de pièces.',
      },
      {
        q: 'Comment sauvegarder une annonce en favori ?',
        a: 'Sur chaque annonce, cliquez sur l\'icône cœur pour l\'ajouter à vos favoris. Retrouvez toutes vos annonces sauvegardées dans "Tableau de bord" > "Favoris".',
      },
      {
        q: 'Puis-je être notifié de nouvelles annonces ?',
        a: 'Oui, abonnez-vous à notre newsletter pour recevoir les meilleures offres dans votre boîte mail. Vous pouvez également activer les notifications dans vos paramètres pour être alerté par push notification.',
      },
    ],
  },
  {
    title: 'Transactions',
    questions: [
      {
        q: 'Comment contacter un vendeur ?',
        a: 'Sur la page de l\'annonce qui vous intéresse, cliquez sur "Contacter le vendeur". Vous pouvez lui envoyer un message direct via notre système de messagerie intégré ou l\'appeler directement si le numéro de téléphone est affiché.',
      },
      {
        q: 'Ciento-Immobilier intervient-il dans les transactions ?',
        a: 'Non, Ciento-Immobilier est une plateforme de mise en relation. Nous ne participons pas aux négociations, contrats ou paiements entre les parties. Nous vous recommandons de prendre toutes les précautions nécessaires et de faire appel à un notaire pour toute transaction.',
      },
      {
        q: 'Comment signaler une annonce frauduleuse ?',
        a: 'Sur chaque annonce, vous trouverez un lien "Signaler" en bas de page. Sélectionnez le motif du signalement et notre équipe examinera le cas dans les plus brefs délais. Les annonces signalées et confirmées frauduleuses seront supprimées.',
      },
    ],
  },
];

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="font-medium text-gray-800 text-sm sm:text-base">{question}</span>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && (
        <div className="px-4 pb-4 text-gray-600 leading-relaxed text-sm">
          {answer}
        </div>
      )}
    </div>
  );
}

export function FAQ() {
  const [activeSection, setActiveSection] = useState(faqSections[0].title);
  const tabsRef = useRef<HTMLDivElement>(null);
  const currentSection = faqSections.find((s) => s.title === activeSection);

  // Scroll active tab into view on mobile
  useEffect(() => {
    if (!tabsRef.current) return;
    const activeTab = tabsRef.current.querySelector(`[data-active="true"]`);
    if (activeTab) {
      activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeSection]);

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3 mb-2">
            <HelpCircle className="w-6 h-6 text-secondary-500" />
            <h1 className="text-2xl font-bold text-gray-900">Questions Fréquentes</h1>
          </div>
          <p className="text-gray-500">Trouvez rapidement les réponses à vos questions</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">

        {/* Mobile: Horizontal scrollable tabs */}
        <div className="lg:hidden mb-6">
          <div
            ref={tabsRef}
            className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {faqSections.map((section) => (
              <button
                key={section.title}
                data-active={activeSection === section.title}
                onClick={() => setActiveSection(section.title)}
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                  activeSection === section.title
                    ? 'bg-secondary-500 text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-secondary-300'
                }`}
              >
                {section.title}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

          {/* Desktop Sidebar */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-4 sticky top-24">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:border-secondary-500 focus:outline-none focus:ring-2 focus:ring-secondary-500/20"
                />
              </div>
              <nav className="space-y-1">
                {faqSections.map((section) => (
                  <button
                    key={section.title}
                    onClick={() => setActiveSection(section.title)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeSection === section.title
                        ? 'bg-secondary-50 text-secondary-700'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {section.title}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Content */}
          <div className="lg:col-span-3">
            {currentSection && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-6">
                  {currentSection.title}
                </h2>
                <div className="space-y-3">
                  {currentSection.questions.map((item) => (
                    <FaqItem key={item.q} question={item.q} answer={item.a} />
                  ))}
                </div>
              </div>
            )}

            {/* Contact CTA */}
            <div className="mt-12 bg-primary-800 rounded-xl p-6 sm:p-8 text-center">
              <h3 className="text-lg sm:text-xl font-bold text-white mb-2">
                Vous n&apos;avez pas trouvé votre réponse ?
              </h3>
              <p className="text-primary-200 mb-6 text-sm sm:text-base">
                Notre équipe est disponible pour répondre à toutes vos questions.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                <a
                  href="mailto:info@ciento-immobilier.com"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-secondary-500 hover:bg-secondary-600 text-white font-semibold rounded-lg transition-colors text-sm"
                >
                  <Mail className="w-4 h-4" />
                  Nous écrire
                </a>
                <a
                  href="tel:+50928131234"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg transition-colors text-sm"
                >
                  <Phone className="w-4 h-4" />
                  +509 2813-1234
                </a>
              </div>
              <div className="flex items-center justify-center gap-2 mt-4 text-primary-300 text-sm">
                <MapPin className="w-4 h-4" />
                Les Gonaïves, Artibonite, Haïti
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
