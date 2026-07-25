import { Shield, Mail, Phone, MapPin } from 'lucide-react';

export function Privacy() {
  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-6 h-6 text-secondary-500" />
            <h1 className="text-2xl font-bold text-gray-900">Politique de Confidentialité</h1>
          </div>
          <p className="text-gray-500 text-sm">Dernière mise à jour : Juillet 2026</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-xl shadow-sm p-8 space-y-8">

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Introduction</h2>
            <p className="text-gray-600 leading-relaxed">
              Chez Ciento-Immobilier, nous prenons la protection de vos données personnelles très au sérieux.
              La présente politique de confidentialité explique comment nous collectons, utilisons, partageons
              et protégeons vos informations lorsque vous utilisez notre plateforme immobilière accessible
              depuis le territoire haïtien et au-delà.
            </p>
            <p className="text-gray-600 leading-relaxed mt-3">
              En utilisant nos services, vous acceptez les pratiques décrites dans cette politique.
              Si vous n&apos;acceptez pas ces termes, veuillez ne pas utiliser notre plateforme.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Données que nous collectons</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-gray-800 mb-2">Données d&apos;inscription</h3>
                <ul className="list-disc list-inside text-gray-600 space-y-1 ml-4">
                  <li>Nom et prénom</li>
                  <li>Adresse email</li>
                  <li>Numéro de téléphone</li>
                  <li>Photo de profil (optionnelle)</li>
                  <li>Rôle (client, agent, agence)</li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-gray-800 mb-2">Données d&apos;annonces</h3>
                <ul className="list-disc list-inside text-gray-600 space-y-1 ml-4">
                  <li>Titre, description, prix des annonces</li>
                  <li>Photos et vidéos des biens</li>
                  <li>Localisation (quartier, ville)</li>
                  <li>Caractéristiques du bien (surface, pièces, etc.)</li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-gray-800 mb-2">Données de navigation</h3>
                <ul className="list-disc list-inside text-gray-600 space-y-1 ml-4">
                  <li>Adresse IP</li>
                  <li>Type de navigateur et appareil</li>
                  <li>Pages visitées et durée de visite</li>
                  <li>Recherches effectuées sur la plateforme</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Utilisation de vos données</h2>
            <p className="text-gray-600 leading-relaxed mb-3">
              Nous utilisons vos données aux fins suivantes :
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li>Fournir et améliorer nos services immobiliers</li>
              <li>Faciliter la mise en relation entre acheteurs, locataires et vendeurs</li>
              <li>Vous envoyer des notifications concernant vos annonces et messages</li>
              <li>Personnaliser votre expérience et les résultats de recherche</li>
              <li>Assurer la sécurité de la plateforme et prévenir la fraude</li>
              <li>Vous envoyer des communications marketing (avec votre consentement)</li>
              <li>Respecter nos obligations légales</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Partage de vos données</h2>
            <p className="text-gray-600 leading-relaxed mb-3">
              Vos données peuvent être partagées avec les catégories suivantes :
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li><strong>Autres utilisateurs :</strong> Lorsque vous publiez une annonce, votre nom et coordonnées sont visibles par les personnes intéressées</li>
              <li><strong>Agences et agents partenaires :</strong> Dans le cadre de transactions immobilières</li>
              <li><strong>Prestataires techniques :</strong> Hébergement (Supabase), analytics, et services d&apos;infrastructure</li>
              <li><strong>Autorités compétentes :</strong> En cas d&apos;obligation légale</li>
            </ul>
            <p className="text-gray-600 leading-relaxed mt-3">
              Nous ne vendons jamais vos données personnelles à des tiers à des fins commerciales.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Cookies et technologies similaires</h2>
            <p className="text-gray-600 leading-relaxed mb-3">
              Nous utilisons les cookies suivants :
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li><strong>Cookies essentiels :</strong> Nécessaires au fonctionnement de la plateforme (session, authentification)</li>
              <li><strong>Cookies de performance :</strong> Pour analyser l&apos;utilisation et améliorer nos services</li>
              <li><strong>Cookies de préférence :</strong> Pour mémoriser vos paramètres (langue, région)</li>
            </ul>
            <p className="text-gray-600 leading-relaxed mt-3">
              Vous pouvez gérer vos préférences de cookies dans les paramètres de votre navigateur.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Sécurité des données</h2>
            <p className="text-gray-600 leading-relaxed">
              Nous mettons en œuvre des mesures de sécurité techniques et organisationnelles appropriées
              pour protéger vos données contre tout accès non autorisé, modification, divulgation ou
              destruction. Ces mesures incluent le chiffrement des données sensibles, l&apos;authentification
              sécurisée et les politiques d&apos;accès restreint.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Conservation des données</h2>
            <p className="text-gray-600 leading-relaxed">
              Vos données personnelles sont conservées tant que votre compte est actif. Après la
              suppression de votre compte, certaines données peuvent être conservées pendant une
              durée maximale de 12 mois pour des obligations légales ou de sécurité. Les données
              de navigation anonymisées peuvent être conservées de manière indéfinie à des fins
              d&apos;analyse statistique.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Vos droits</h2>
            <p className="text-gray-600 leading-relaxed mb-3">
              Conformément aux bonnes pratiques en matière de protection des données, vous disposez des droits suivants :
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li><strong>Droit d&apos;accès :</strong> Obtenir une copie de vos données personnelles</li>
              <li><strong>Droit de rectification :</strong> Corriger les données inexactes</li>
              <li><strong>Droit de suppression :</strong> Demander la suppression de vos données</li>
              <li><strong>Droit d&apos;opposition :</strong> Vous opposer au traitement de vos données</li>
              <li><strong>Droit à la portabilité :</strong> Recevoir vos données dans un format structuré</li>
            </ul>
            <p className="text-gray-600 leading-relaxed mt-3">
              Pour exercer ces droits, contactez-nous à l&apos;adresse indiquée ci-dessous.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Modification de cette politique</h2>
            <p className="text-gray-600 leading-relaxed">
              Nous nous réservons le droit de modifier cette politique de confidentialité à tout moment.
              Toute modification substantielle sera communiquée via la plateforme ou par email.
              L&apos;utilisation continue de nos services après modification constitue votre acceptation
              des nouveaux termes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Contact</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              Pour toute question relative à cette politique de confidentialité ou à la protection
              de vos données, veuillez nous contacter :
            </p>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-3 text-gray-600 text-sm">
                <MapPin className="w-4 h-4 text-secondary-500 shrink-0" />
                <span>Les Gonaïves, Artibonite, Haïti</span>
              </div>
              <div className="flex items-center gap-3 text-gray-600 text-sm">
                <Mail className="w-4 h-4 text-secondary-500 shrink-0" />
                <span>privacy@ciento-immobilier.com</span>
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
