import { FileText, Mail, Phone, MapPin } from 'lucide-react';

export function Terms() {
  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="w-6 h-6 text-secondary-500" />
            <h1 className="text-2xl font-bold text-gray-900">Conditions d&apos;Utilisation</h1>
          </div>
          <p className="text-gray-500 text-sm">Dernière mise à jour : Juillet 2026</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-xl shadow-sm p-8 space-y-8">

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Acceptation des conditions</h2>
            <p className="text-gray-600 leading-relaxed">
              En accédant et en utilisant la plateforme Ciento-Immobilier, vous acceptez sans réserve
              les présentes conditions d&apos;utilisation. Si vous n&apos;acceptez pas ces conditions,
              veuillez ne pas utiliser notre plateforme. Nous nous réservons le droit de modifier
              ces conditions à tout moment, et votre utilisation continue de la plateforme après
              toute modification constitue votre acceptation des nouvelles conditions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Description du service</h2>
            <p className="text-gray-600 leading-relaxed mb-3">
              Ciento-Immobilier est une plateforme en ligne de mise en relation dans le domaine
              immobilier en Haïti. Nos services comprennent :
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li>Publication et consultation d&apos;annonces immobilières (vente et location)</li>
              <li>Recherche avancée de biens par localisation, type, prix et critères divers</li>
              <li>Mise en relation directe entre acheteurs/locataires et vendeurs/agences</li>
              <li>Gestion de favoris et de conversations entre utilisateurs</li>
              <li>Espace professionnel pour les agents et agences immobilières</li>
            </ul>
            <p className="text-gray-600 leading-relaxed mt-3">
              La plateforme agit en tant qu&apos;intermédiaire technique et ne parties prenante
              directe aux transactions immobilières conclues entre les utilisateurs.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Inscription et compte</h2>
            <div className="space-y-3">
              <p className="text-gray-600 leading-relaxed">
                L&apos;utilisation de certaines fonctionnalités nécessite la création d&apos;un compte.
                Lors de l&apos;inscription, vous vous engagez à :
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                <li>Fournir des informations exactes, complètes et à jour</li>
                <li>Maintenir la confidentialité de vos identifiants de connexion</li>
                <li>Ne pas partager votre compte avec des tiers</li>
                <li>Notifier immédiatement toute utilisation non autorisée de votre compte</li>
                <li>Être âgé d&apos;au moins 18 ans ou avoir l&apos;autorisation d&apos;un parent ou tuteur</li>
              </ul>
              <p className="text-gray-600 leading-relaxed mt-3">
                Nous nous réservons le droit de suspendre ou supprimer tout compte qui enfreint
                ces conditions ou qui reste inactif pendant une période excessive.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Règles de publication d&apos;annonces</h2>
            <div className="space-y-3">
              <p className="text-gray-600 leading-relaxed">
                En publiant une annonce sur Ciento-Immobilier, vous vous engagez à :
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                <li>Être propriétaire ou avoir l&apos;autorisation du propriétaire du bien</li>
                <li>Ne pas publier d&apos;annonces fictives, trompeuses ou dupliquées</li>
                <li>Fourir des photos réelles et représentatives du bien</li>
                <li>Décrire fidèlement les caractéristiques, l&aposétat et le prix du bien</li>
                <li>Ne pas publier d&apos;annonces discriminatoires</li>
                <li>Respecter les lois et réglementations haïtiennes en vigueur</li>
                <li>Ne pas utiliser la plateforme pour vendre des biens illicites</li>
              </ul>
              <p className="text-gray-600 leading-relaxed mt-3">
                Les annonces non conformes seront supprimées sans préavis. Les utilisateurs
                récidivistes pourront voir leur compte suspendu définitivement.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Propriété intellectuelle</h2>
            <p className="text-gray-600 leading-relaxed mb-3">
              L&apos;ensemble du contenu de la plateforme (logo, design, code, textes, images)
              est la propriété exclusive de Ciento-Immobilier ou de ses partenaires et est protégé
              par les droits de propriété intellectuelle.
            </p>
            <p className="text-gray-600 leading-relaxed">
              En publiant des photos ou du contenu sur la plateforme, vous accordez à Ciento-Immobilier
              une licence non exclusive, mondiale et gratuit d&apos;utiliser, reproduire et afficher
              ce contenu dans le cadre du fonctionnement de la plateforme.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Responsabilités et limitations</h2>
            <div className="space-y-3">
              <p className="text-gray-600 leading-relaxed">
                Ciento-Immobilier s&apos;efforce de fournir un service fiable mais ne garantit pas :
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                <li>L&apos;exactitude des informations publiées par les utilisateurs</li>
                <li>La disponibilité ininterrompue de la plateforme</li>
                <li>L&apos;absence d&apos;erreurs ou de bugs</li>
                <li>Le succès des transactions entre utilisateurs</li>
              </ul>
              <p className="text-gray-600 leading-relaxed mt-3">
                Ciento-Immobilier ne saurait être tenu responsable des dommages directs ou indirects
                résultant de l&apos;utilisation de la plateforme, y compris la perte de données,
                les pertes financières ou les préjudices moraux.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Liens et services tiers</h2>
            <p className="text-gray-600 leading-relaxed">
              La plateforme peut contenir des liens vers des sites web ou services tiers.
              Ces liens sont fournis à titre informatif uniquement. Ciento-Immobilier n&apos;exerce
              aucun contrôle sur ces sites externes et ne saurait être tenu responsable de leur
              contenu, de leurs pratiques de confidentialité ou de leurs services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Suspension et résiliation</h2>
            <p className="text-gray-600 leading-relaxed">
              Nous nous réservons le droit de suspendre ou de résilier votre accès à la plateforme
              à tout moment, sans préavis, en cas de manquement aux présentes conditions ou pour
              tout autre motif jugé nécessaire par notre équipe. Vous pouvez également supprimer
              votre compte à tout moment depuis les paramètres de votre profil.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Droit applicable</h2>
            <p className="text-gray-600 leading-relaxed">
              Les présentes conditions sont régies par les lois de la République d&apos;Haïti.
              Tout litige relatif à l&apos;interprétation ou à l&apos;exécution de ces conditions
              sera soumis à la compétence des tribunaux compétents de Port-au-Prince.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Contact</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              Pour toute question concernant ces conditions d&apos;utilisation, contactez-nous :
            </p>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-3 text-gray-600 text-sm">
                <MapPin className="w-4 h-4 text-secondary-500 shrink-0" />
                <span>Les Gonaïves, Artibonite, Haïti</span>
              </div>
              <div className="flex items-center gap-3 text-gray-600 text-sm">
                <Mail className="w-4 h-4 text-secondary-500 shrink-0" />
                <span>legal@ciento-immobilier.com</span>
              </div>
              <div className="flex items-center gap-3 text-gray-600 text-sm">
                <Phone className="w-4 h-4 text-secondary-500 shrink-0" />
                <span>+509 2813-1234</span>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
