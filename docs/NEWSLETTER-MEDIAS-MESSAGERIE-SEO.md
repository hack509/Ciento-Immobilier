# CIENTO-IMMOBILIER : newsletter, médias, messagerie, interactivité et SEO

Rapport de livraison des modules 1 à 9. Rien n'a été déployé. Aucune base de production n'a été modifiée.

---

## 1. Audit initial (phase 1)

| Domaine | Constat avant intervention |
|---|---|
| Newsletter | Double opt-in fonctionnel (Edge Functions `newsletter-subscribe` et `newsletter-manage`, envoi via Resend). En revanche : un simple booléen `is_active` en guise de statut, aucune preuve de consentement, aucune interface d'administration, aucune campagne. |
| Formulaire Contact | **Ne fonctionnait pas** : il envoyait vers `/api/contact`, qui n'existe pas. Les messages étaient perdus et une erreur s'affichait systématiquement. |
| Favoris (fiche annonce) | Le bouton « Favoris » était décoratif. Le service `favorites.add()` insérait aussi sans `user_id` : **l'ajout aux favoris échouait toujours** (contrainte NOT NULL et règle RLS). |
| Photos de profil | La colonne `profiles.avatar_url` existait, mais aucun moyen de téléverser une photo. |
| Médias d'annonce | Les images étaient envoyées directement dans le stockage, sans vérifier le contenu réel du fichier. Les GIF étaient acceptés. Pas d'optimisation ni de miniature. La table `property_videos` n'était jamais utilisée. Chaque image demandait une requête de signature séparée. |
| Liens morts | Les icônes Facebook, Instagram et WhatsApp du pied de page pointaient vers `#`. |
| SEO | Métadonnées uniquement côté client (invisibles pour Facebook et WhatsApp). Domaine canonique codé en dur. `sitemap.xml` déclaré mais inexistant. Aucun `noindex` sur les espaces privés. |

Pour éviter les doublons, les tables existantes ont été **étendues** plutôt que dupliquées :
- `newsletter_subscribers` est enrichie ;
- `property_images` et `property_videos` sont enrichies, et réunies dans la vue `property_media` ;
- `notifications` sert aux notifications des administrateurs ;
- `profiles` joue le rôle de « user_profiles ».

---

## 2. Fonctionnalités livrées

### Module 1 — Newsletter (`/admin/newsletter`)

**Abonnés**
- 4 statuts : actif, en attente, désabonné, suspendu. Ils restent synchronisés avec l'ancien `is_active` par trigger, donc les fonctions existantes continuent de marcher.
- Recherche, filtres par statut et par période, pagination côté serveur, fiche détaillée.
- Suspension avec motif. Une adresse suspendue ne peut pas se réactiver toute seule.
- Archivage, suppression définitive (droit à l'effacement), export CSV (protégé contre l'injection de formules Excel).

**Preuve de consentement**
- Table append-only `newsletter_consent_events` : demande, confirmation, désabonnement, suspension, etc.
- Pour chaque événement : formulaire d'origine, **empreinte SHA-256 de l'IP** (jamais l'IP en clair), navigateur.

**Inscription**
- Validation de l'adresse et protection contre les doublons (index unique existant).
- Le message affiché après inscription dit clairement que l'abonnement attend la confirmation par e-mail.

**Campagnes**
- Éditeur avec prévisualisation en direct (iframe isolée) et e-mail de test envoyé uniquement à l'administrateur.
- Confirmation avant l'envoi, puis envoi par lots avec progression et reprise possible.
- Statistiques : envoyés, livrés, ouverts, clics, rebonds, échecs. Les rebonds et plaintes suspendent automatiquement l'abonné.
- Chaque e-mail contient un lien de désabonnement en un clic (en-têtes RFC 8058) valable 1 an.
- **Sans fournisseur configuré, l'envoi est désactivé et l'interface l'indique** : aucune campagne n'est marquée comme envoyée à tort.
- Le contenu est en Markdown restreint, systématiquement échappé : aucune injection HTML ou script possible.

### Module 2 — Photo de profil (Paramètres et Mon profil)

- Import, aperçu, **recadrage carré** (glisser et zoom, aussi au clavier), progression, remplacement et suppression avec confirmation.
- Les initiales s'affichent par défaut.
- Côté navigateur : le vrai format est vérifié (octets du fichier) puis l'image est réencodée en WebP 400 px, ce qui supprime aussi les métadonnées comme la position GPS.
- Côté serveur, l'Edge Function `media` revérifie les octets stockés et la taille (2 Mo, réglable).
- Le fichier est rangé dans le dossier de l'utilisateur, sous un nom unique ; les anciennes photos sont supprimées.
- Un trigger empêche de faire pointer `avatar_url` vers autre chose que son propre dossier du bucket `avatars`.
- La photo apparaît dans le menu, le tableau de bord, les cartes propriétaire et agent, et l'équipe d'agence (composants existants).

### Module 3 — Médias des annonces

**Formulaire d'annonce : section « Galerie de médias »**
- Envoi de plusieurs fichiers par glisser-déposer, deux en parallèle, avec progression et erreur affichées fichier par fichier.
- Réorganisation par glisser-déposer, ou par flèches sur mobile et au clavier. L'enregistrement est immédiat, avec retour arrière si le serveur refuse.
- Choix de l'image principale, suppression avec confirmation.
- Ajout d'un lien : image en https (vérifiée dans le navigateur avant d'être acceptée), YouTube, Vimeo ou fichier `.mp4`/`.webm`.
- Après la création d'une annonce, l'utilisateur arrive directement sur cette section.

**Optimisation**
- WebP 1920 px qualité 0,82, plus une miniature de 480 px.
- Chargement différé (lazy loading), signature des URL d'images regroupée en une seule requête par lot.

**Galerie publique**
- Image principale, miniatures, navigation par flèches, clavier ou glissement du doigt, plein écran, préchargement de l'image suivante.
- Les vidéos YouTube et Vimeo ne chargent leur lecteur qu'au clic (iframe `youtube-nocookie`, `sandbox`). Aucune autre adresse n'est jamais intégrée en iframe.
- Signalement d'un média par les utilisateurs connectés.

**Sécurité**
- Les fichiers ne transitent que par des URL d'envoi signées, délivrées par l'Edge Function `media` après contrôle des droits et des limites.
- L'écriture directe dans le stockage par le client est **fermée**.
- À la finalisation, les octets stockés sont relus : un fichier déguisé est supprimé. Sont notamment refusés : SVG, HTML, exécutables, GIF, HEIC.
- Limites réglables : 5 Mo par image, 50 Mo par vidéo, 20 images et 3 vidéos par annonce.
- Le bucket `property-videos` est privé, lu via des URL signées.
- Les fichiers orphelins sont détectés en SQL et supprimés par l'administrateur.

**Administration (`/admin/medias`)** : médias signalés en premier, motifs des signalements, approuver / retirer (journalisé) / supprimer, lien vers l'annonce, nettoyage des orphelins.

### Module 4 — Boîte de réception (`/admin/messages`)

**Centralisation**
- Tous les formulaires arrivent dans `contact_messages` : page Contact (corrigée), nouveau formulaire sur les pages d'agence, demandes sur annonce et demandes de service (copiées automatiquement par trigger).
- Chaque message garde : nom, e-mail, téléphone, objet, contenu, date, source, annonce et agence concernées, empreinte d'IP.
- Limite de 5 messages par heure et par e-mail (réglable), plafond par IP, anti-doublon et champ piège anti-robots.

**Interface**
- Filtres Tous, Non lus, Lus, En attente, En cours, Répondus, Archivés ; filtre par source ; recherche par nom, e-mail ou objet ; pagination.
- Compteur « non lus » dans le menu. Les demandes sur annonce, traitées par les propriétaires, ne le gonflent pas.
- **Mise à jour en temps réel** via Supabase Realtime, avec une actualisation toutes les 60 s en secours.

**Détail d'un message**
- Expéditeur, contenu, lien vers l'annonce, notes internes, historique de toutes les actions, assignation à un administrateur (qui reçoit une notification).
- Changement de statut, archivage. La suppression est réservée au super administrateur.
- Le contenu reçu est **non modifiable** : c'est une pièce de suivi.

**Réponses**
- « Répondre (messagerie) » ouvre le logiciel d'e-mail avec l'adresse, l'objet et la citation préremplis. **Rien n'est marqué comme envoyé** tant que l'administrateur ne clique pas sur « J'ai répondu ».
- Si un fournisseur d'e-mail est configuré, la réponse peut partir depuis la plateforme. Elle n'est marquée « répondue » que si le fournisseur a accepté l'envoi.

**Notifications** : notification interne à chaque administrateur, et e-mail d'alerte optionnel via l'Edge Function `contact-notify`.

### Module 5 — Interactivité, performance et responsive

- Bouton **Favoris** réparé : mise à jour immédiate de l'affichage, retour arrière en cas d'erreur, redirection vers la connexion si besoin.
- Formulaire Contact réparé ; liens morts du pied de page supprimés (WhatsApp réel, réseaux sociaux affichés seulement s'ils sont configurés).
- **Notifications toast** (succès et erreurs) pour toutes les nouvelles actions et pour la suppression d'annonce, qui échouait jusque-là sans message.
- Les nouvelles actions sensibles demandent une confirmation. Les doubles soumissions sont bloquées (états de chargement, garde dans les fonctions).
- Recherche avec temporisation, pagination côté serveur, squelettes de chargement, états vides informatifs.
- Signature des images regroupée : le catalogue faisait jusqu'à N requêtes, il en fait désormais une par page.
- Logo de l'interface en WebP : 56 Ko → 11,5 Ko.
- Accessibilité : contraste corrigé, hiérarchie des titres corrigée (états vides en `h2`).
- Responsive vérifié à 412 px (émulation mobile de Lighthouse) : pas de débordement horizontal, menu mobile fonctionnel.

### Module 6 — SEO technique

- **Configuration centrale** (`src/lib/seo-core.ts`) : titre « CIENTO-IMMOBILIER | Trouvez votre maison, appartement ou terrain en Haïti », description officielle, image Open Graph 1200×630 (`public/og-image.jpg`), couleur de thème #1D3E91.
- **Annonces** : titre, description, URL canonique et données structurées propres à chaque annonce, rédigés à partir du type, de la commune, du quartier, du prix et des caractéristiques. Exemple : « Maison à vendre aux Gonaïves (Raboteau) — 3 ch., 2 sdb, 140 m² ». **Aucune donnée personnelle du propriétaire** n'y figure.
- **Lien court** `/propriete/:slug`, qui redirige vers l'URL canonique `/annonces/:ville/:slug`. Les routes existantes n'ont pas changé, ce qui préserve les liens déjà partagés.
- **Rendu côté serveur des balises** (Edge Function Vercel `api/render.ts`) pour les annonces, agences et services : les aperçus Facebook et WhatsApp et les robots voient le bon titre et la bonne image.
  - Annonce introuvable ou expirée : **code 404 + `noindex`**.
  - Mauvaise ville dans l'URL : **redirection 301** vers l'URL canonique.
- **Données structurées (JSON-LD)** : Organization et WebSite (avec recherche) sur l'accueil, BreadcrumbList sur toutes les pages avec fil d'Ariane, RealEstateListing pour les annonces, RealEstateAgent pour les agences vérifiées, Service pour les services. Aucune note, aucun avis, aucune disponibilité inventés.
- **`sitemap.xml` dynamique** (`api/sitemap.ts`) : pages publiques, annonces publiées et validées, agences vérifiées, services. Sont exclus les espaces privés, les pages de connexion, l'administration et les résultats filtrés.
- **`robots.txt`** généré au build avec le vrai domaine : bloque `/dashboard`, `/admin`, `/auth/`, `/api/` et les recherches filtrées.
- **`noindex`** sur les tableaux de bord, l'authentification et la page 404, doublé d'un en-tête `X-Robots-Tag` côté Vercel. Les combinaisons de filtres du catalogue sont en `noindex, follow` avec une URL canonique `/annonces`, et la pagination a sa propre URL canonique.
- Balises de vérification Google et Bing et GA4 (anonymisation de l'IP, pages vues sans paramètres d'URL), activés uniquement par variables d'environnement.

> L'indexation n'est **pas** garantie par ces fichiers : elle dépend de l'exploration et des décisions de Google et Bing. La procédure de soumission est en section 6.

---

## 3. Base de données — migration `019_newsletter_media_inbox.sql`

Migration additive et idempotente. Retour arrière : `supabase/rollbacks/019_newsletter_media_inbox.down.sql`.

**Tables créées**
- `newsletter_consent_events`
- `newsletter_campaigns`
- `newsletter_campaign_logs`
- `contact_messages`
- `contact_message_notes`
- `contact_message_history`
- `media_reports`

**Tables étendues**
- `newsletter_subscribers` : statut, source, dates, archivage.
- `property_images` : source, lien externe, miniature, type, taille, modération.
- `property_videos` : fournisseur, identifiant de la vidéo, modération.

**Vue** : `property_media` (règles d'accès héritées des tables).

**Stockage**
- Buckets `avatars` (public) et `property-videos` (privé).
- `property-images` limité à JPG, PNG et WebP.
- Écritures directes par le client fermées.

**Droits d'accès (RLS)**
- Messages de contact : lecture et modification par les administrateurs ; l'agence ne voit que les siens ; suppression réservée au super administrateur.
- Abonnés, campagnes et consentements : administrateurs uniquement.
- Fonctions d'envoi : `service_role` uniquement.
- Médias retirés invisibles du public.

**Temps réel** : `contact_messages` et `notifications` ajoutées à la publication `supabase_realtime`.

> **Ordre de déploiement obligatoire :** déployer l'Edge Function `media` **avant** d'appliquer la migration 019, sinon les téléversements de photos ne fonctionneront plus (l'écriture directe dans le stockage est fermée).

---

## 4. Résultats des tests

| Suite | Commande | Résultat |
|---|---|---|
| SQL (PostgreSQL 16 dans Docker, migrations 001→019) | `npm run test:db` | **72 scénarios OK** : 47 existants + 25 nouveaux. Réapplication de 016–019 et rollbacks 019→016 vérifiés. |
| Unitaires et composants (Vitest) | `npm test` | **67/67** (+35 nouveaux) |
| Typecheck + build de production | `npm run build` | OK |
| Lint | `npm run lint` | OK : 1 avertissement, antérieur à ce travail (`AuthContext.tsx`) |
| Lighthouse 12.6, mobile simulé, build local | voir ci-dessous | SEO **100** partout |

**Ce que couvrent les tests SQL**
- Newsletter : inscription valide, e-mail invalide, doublon, confirmation, consentement avec IP en empreinte, suspension persistante.
- Campagnes : réservées aux admins, gelées après lancement, pas de double envoi, envoi par lots, statut final exact, événements du fournisseur comptés une seule fois, désabonnement par lien à usage unique.
- Messagerie : enregistrement, doublons et limitation de débit, confidentialité, notification des admins, copie des demandes sur annonce, routage vers l'agence, journalisation, contenu non modifiable, droits d'assignation et de suppression.
- Médias : https uniquement, URL piégées refusées, liste blanche des vidéos, limite par annonce, champs serveur protégés, écriture directe au stockage fermée, signalement unique, modération, média retiré invisible du public, détection des orphelins.
- Avatars : dossier personnel uniquement, suppression possible, pas d'envoi direct.

**Ce que couvrent les tests unitaires**
- Détection du vrai format (JPEG, PNG, WebP, MP4, WebM ; refus de SVG, HTML, EXE, GIF, HEIC) et chemins de fichiers sûrs.
- Analyse des liens vidéo, CSV sûr, rendu de newsletter sans injection.
- Fournisseurs Resend et Brevo, signature des webhooks (falsification et rejeu refusés), lien de réponse par e-mail.
- Métadonnées SEO, injection des balises côté serveur (échappement), sitemap, robots, 404, redirection 301, galerie sans lecteur tiers avant le clic.

**Lighthouse (mobile simulé)**

| Page | Performance | Accessibilité | Bonnes pratiques | SEO |
|---|---|---|---|---|
| Accueil | 63 | 100 | 96 | 100 |
| Annonces | 59 | 98 → corrigé | 96 | 100 |
| Contact | 80 | 100 | 100 | 100 |
| Services | 61 | 100 | 100 | 100 |
| Tarifs | 76 | 95 → corrigé | 100 | 100 |

- Le score « Bonnes pratiques » de 96 vient d'erreurs 400 dans la console : le projet Supabase actuel ne contient pas encore les migrations 016–019. Elles disparaîtront après migration.
- La performance (LCP environ 3,2 à 4,2 s, mesures variables sur ce poste) est surtout limitée par le rendu 100 % côté client. Le levier suivant est un prérendu des pages publiques (voir section 7).

**Non testé automatiquement**
- Envois réels Resend ou Brevo, MonCash et Realtime : aucun identifiant de test disponible.
- Déploiement des Edge Functions et du projet Vercel.
- Tests manuels sur appareils physiques et navigateurs Safari ou Firefox.

---

## 5. Variables d'environnement

Toutes sont documentées dans `.env.example`.

**Frontend (publiques, préfixe `VITE_`)**
- `VITE_APP_URL` : **le domaine final, obligatoire pour le SEO**.
- `VITE_GOOGLE_SITE_VERIFICATION`, `VITE_BING_SITE_VERIFICATION`, `VITE_GA_MEASUREMENT_ID`.
- `VITE_FACEBOOK_URL`, `VITE_INSTAGRAM_URL`.

**Secrets Edge Functions (`supabase secrets set …`)**
- Fournisseur : `EMAIL_PROVIDER`, `RESEND_API_KEY` ou `BREVO_API_KEY`.
- Expéditeur : `EMAIL_FROM`, `EMAIL_FROM_NAME`, `EMAIL_REPLY_TO`, `SITE_URL`.
- Alertes : `ADMIN_NOTIFICATION_EMAIL`, `CONTACT_WEBHOOK_SECRET`.
- Statistiques : `RESEND_WEBHOOK_SECRET`, `BREVO_WEBHOOK_SECRET`.
- Sécurité : `ALLOWED_ORIGINS`.

---

## 6. Configuration des services externes

1. **Edge Functions**

   ```
   supabase functions deploy media admin-mail email-webhook contact-notify newsletter-subscribe
   ```

   Ensuite, appliquer la migration 019 (staging d'abord).

2. **Fournisseur d'e-mail (Resend recommandé)**
   - Vérifier le domaine d'envoi (SPF, DKIM, DMARC), puis définir `EMAIL_PROVIDER=resend`, `RESEND_API_KEY` et `EMAIL_FROM`.
   - Créer le webhook `https://<projet>.supabase.co/functions/v1/email-webhook` avec les événements *delivered, opened, clicked, bounced, complained*, et copier le secret dans `RESEND_WEBHOOK_SECRET`.
   - Pour Brevo, l'URL est `…/email-webhook?provider=brevo&secret=<BREVO_WEBHOOK_SECRET>`.

3. **Alerte e-mail des nouveaux messages**
   - Supabase → Database → Webhooks → INSERT sur `public.contact_messages`.
   - URL : `…/functions/v1/contact-notify`, avec l'en-tête `x-webhook-secret: <CONTACT_WEBHOOK_SECRET>`.

4. **Temps réel** : vérifier dans Supabase → Database → Publications que `contact_messages` et `notifications` sont dans `supabase_realtime` (la migration les ajoute si la publication existe).

5. **Vercel**
   - Définir `VITE_APP_URL` sur le domaine définitif. Les fonctions `api/render` et `api/sitemap` utilisent `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`.
   - Les réécritures sont dans `vercel.json`.

6. **Google Search Console**
   - Ajouter une propriété de type *Domaine* (vérification DNS TXT, recommandée), ou *Préfixe d'URL* avec la balise HTML (`VITE_GOOGLE_SITE_VERIFICATION`, puis redéployer).
   - Ensuite : *Sitemaps* → soumettre `https://<domaine>/sitemap.xml`, puis *Inspection d'URL* → « Demander une indexation » pour l'accueil et quelques annonces.

7. **Bing Webmaster Tools** : importer le site depuis Search Console (ou utiliser la balise `msvalidate.01`), puis soumettre le même sitemap.

8. **GA4** : créer un flux Web, renseigner `VITE_GA_MEASUREMENT_ID`, puis redéployer.

---

## 7. Problèmes non résolus et recommandations

- **Performance** : passer au prérendu ou à l'hydratation des pages publiques (prerender Vite au build, ou migration vers un framework SSR) pour viser un LCP inférieur à 2,5 s. Le plafond actuel vient du rendu côté client.
- **SMTP direct** : non disponible depuis les Edge Functions. Utiliser l'API HTTP d'un relais (Resend, Brevo, SES…).
- Les **liens `<Link><Button>`** existants imbriquent un bouton dans un lien. C'est fonctionnel mais pas idéal en accessibilité ; les remplacer progressivement par un `Link` stylé.
- La **réponse depuis la plateforme** n'archive pas de copie complète de l'e-mail envoyé : seul l'historique (fournisseur, identifiant, objet) est conservé.
- **Médias externes** : une image hébergée ailleurs peut disparaître sans prévenir. La galerie affiche alors « Image indisponible » ; privilégier l'envoi direct.
- **Mise en production** : staging d'abord, sauvegarde de la base, déploiement des fonctions avant la migration 019, contrôle du parcours complet, puis production.
