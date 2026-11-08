# Ciento-Immobilier : évolution vers une marketplace monétisée

Rapport de livraison, phases 1 à 8. Branche `feat/ui-refresh`. Rien n'a été déployé et aucune base de production n'a été modifiée.

---

## Phase 1 : audit de l'existant

**Stack.** React 19, Vite 8, TypeScript 6 (strict, `erasableSyntaxOnly`), Tailwind 4, TanStack Query 5, React Router 7, Supabase (Auth, Postgres + RLS, Storage, Edge Functions). Déploiement sur Vercel.

**Déjà en place (non modifié fonctionnellement) :**
- Annonces publiques, recherche, filtres de base (type, transaction, ville, budget) et fiche détail.
- Auth : inscription, connexion, réinitialisation. Le profil est créé par trigger et l'auto-attribution de rôle est bloquée.
- Dashboard utilisateur : annonces, formulaire, favoris, messagerie, notifications, profil, paramètres.
- Administration : modération des annonces, utilisateurs, signalements.
- Sécurité (migrations 012 et 014) : RLS sur toutes les tables, vue `public_profiles`, champs de modération protégés, stockage restreint au propriétaire, newsletter tokenisée.

**Manquant au départ :** espace agence et équipe, prospects, statistiques, abonnements, paiements, factures, annonces sponsorisées et Premium, services immobiliers, publicité, finances, journal d'audit, filtres avancés (quartier, chambres, salles de bain, surface, disponibilité), données structurées SEO, tests.

**Risques corrigés pendant l'audit :**

| Risque | Correction |
|---|---|
| N'importe quel utilisateur pouvait rattacher une annonce à **l'agence d'un autre** (`agency_id` libre à l'insertion) | Trigger `validate_property_affiliation` |
| Un propriétaire pouvait gonfler `views_count` / `favorites_count` | Trigger `protect_property_server_fields` |
| La recherche texte injectait la saisie brute dans un filtre PostgREST `or(...)` | `sanitizeSearchTerm` |
| Le champ « site web » d'une agence aurait pu contenir `javascript:` | Contrainte SQL + garde côté UI |
| L'auteur d'une annonce d'agence gardait ses droits après retrait de l'agence (détecté par les tests) | Politiques RLS resserrées |

---

## Phase 2 : architecture

### Rôles (RBAC)

| Rôle demandé | Implémentation |
|---|---|
| visitor | `anon` (non connecté) |
| owner | `profiles.role = owner` (ou `client`) |
| agency | `profiles.role = agency`, attribué par un admin à la validation de l'agence |
| agency_member | ligne `agency_members` (rôle `manager` ou `agent`) avec permissions `can_publish`, `can_manage_leads`, `can_manage_billing` |
| admin / super_admin | inchangés. Seul `super_admin` modifie les paramètres et les rôles admin |

L'enum `user_role` existant n'a pas été modifié, pour préserver la compatibilité des données.

### Correspondance des entités

| Entité demandée | Table |
|---|---|
| users / user_profiles | `auth.users` / `profiles` (existants) |
| agencies | `agencies` (existante, enrichie) |
| agency_members | `agency_members` (nouvelle) |
| properties, property_images | existantes, enrichies |
| property_favorites | `favorites` (existante) |
| property_inquiries | `property_inquiries` (nouvelle) |
| subscription_plans, subscriptions, payments, invoices | nouvelles |
| sponsored_listings / premium_listings | vues sur `listing_promotions` (table unique avec `kind`) |
| service_categories, service_requests | nouvelles (7 services de référence) |
| advertising_campaigns, advertising_impressions, advertising_clicks | nouvelles |
| notifications | existante |
| audit_logs | nouvelle (`activity_logs` conservée) |

Tables complémentaires : `promotion_offers` (tarifs 7, 15 et 30 jours), `property_daily_stats` (graphiques).

### Contrats API (RPC Supabase)

| RPC | Appelant | Rôle |
|---|---|---|
| `submit_property_inquiry` | anon, auth | Contact d'un annonceur (limité à 5/h par e-mail, anti-doublon 10 min) |
| `submit_service_request` | anon, auth | Demande de service (5/jour par e-mail) |
| `track_ad_event` | anon, auth | Impression ou clic publicitaire, dédupliqué par session |
| `add_agency_member`, `request_agency_verification` | auth | Équipe et validation |
| `get_my_quota`, `get_listing_stats` | auth | Quotas, statistiques |
| `checkout_subscription`, `checkout_subscription_renewal`, `checkout_promotion` | auth | Crée un paiement **en attente**, montant calculé côté serveur |
| `start_subscription_trial`, `set_subscription_cancellation`, `redeem_sponsored_credit`, `cancel_my_payment` | auth | Cycle de vie |
| `confirm_payment`, `fail_payment` | **service_role uniquement** | Confirmation par le prestataire |
| `admin_*` (confirmation manuelle, remboursement, agences, promotions, rapports, statistiques) | admin (vérifié en SQL) | Back-office |
| `run_marketplace_maintenance` | pg_cron, admin | Expirations |

---

## Migrations

Les trois migrations sont **additives, idempotentes et réversibles**. Elles ont été testées sur PostgreSQL 16.

| Fichier | Contenu | Rollback |
|---|---|---|
| `016_marketplace_core.sql` | Colonnes `available_from`, `sponsored_until`, `premium_until`, `premium_details` ; `agency_members` et permissions ; accès portefeuille (RLS et storage) ; prospects ; statistiques journalières ; paramètres | `supabase/rollbacks/016_marketplace_core.down.sql` |
| `017_monetization.sql` | Formules, abonnements, paiements, factures, promotions, services, publicité, quotas, expirations (pg_cron), bucket `brand-assets` | `…/017_monetization.down.sql` |
| `018_admin_audit.sql` | `audit_logs` et triggers, RPC d'administration, rapports | `…/018_admin_audit.down.sql` |

> ⚠️ **À valider avant la production.** Appliquer d'abord sur un projet de staging (`supabase db push`). Les rollbacks 016 et 017 suppriment des données (prospects, paiements) : exporter avant toute exécution.

**Données de démarrage.** Elles sont limitées à la configuration : les formules Starter, Business et Enterprise ainsi que les offres 7, 15 et 30 jours sont créées **inactives à 0 HTG**. Rien n'est vendable tant qu'un admin n'a pas fixé les prix dans *Admin → Abonnements & tarifs* et *Admin → Promotions*. Les 7 services immobiliers sont du contenu de référence. Aucune donnée fictive n'est créée.

---

## Phases 3 à 6 : fonctionnalités livrées

**Site public**
- `/tarifs` : formules, bascule mensuel/annuel, tableau comparatif, offres de visibilité.
- `/services` et `/services/:slug` : 7 services, chacun avec son formulaire de demande.
- `/agences` et `/agences/:slug` : annuaire des agences vérifiées, page publique avec équipe, annonces, couleur personnalisée (Enterprise) et JSON-LD `RealEstateAgent`.
- Catalogue : quartier, chambres, salles de bain, surface, « disponible maintenant ». Les annonces sponsorisées puis Premium apparaissent en premier ; emplacement publicitaire.
- Fiche annonce : formulaire de contact sans compte, partage natif ou copie du lien, galerie Premium (8 vignettes), informations Premium, badges, date de disponibilité, JSON-LD `RealEstateListing`, `noindex` si l'annonce est indisponible.
- Accueil : section « Annonces sponsorisées », bannière publicitaire, appel vers les offres pro.
- **Heros modernisés** avec le composant `PageHero` sur Annonces, Louer, Vendre, Agents, Contact, FAQ, Courte durée, Confidentialité, Conditions et les nouvelles pages : dégradé bleu logo `#1D3E91` vers navy, grille architecturale, liseré jaune `#F4D000`, fil d'Ariane, chiffres clés. Le hero de l'accueil est conservé tel quel.

**Dashboard propriétaire et agence.** Un sélecteur « Espace personnel / Agence » est partagé par les pages concernées.
- Contacts & prospects (statuts), Statistiques (graphique, 7 jours gratuits, 30 et 90 jours avec la formule).
- Promotions (achat ou crédit inclus, historique), Abonnement (souscription, essai, changement avec prorata, renouvellement, annulation à l'échéance), Factures & paiements (facture imprimable en PDF), page de paiement.
- Agence : profil (logo, couverture, validation), portefeuille par statut, équipe et permissions.
- Formulaire d'annonce : date de disponibilité, publication pour l'agence (`?agence=`), message clair quand le quota est atteint.

**Administration (8 nouvelles pages)**
- Agences, Abonnements & tarifs, Paiements, Promotions, Services, Publicités, Rapports financiers, Paramètres & audit.
- La vue d'ensemble affiche les nouveaux indicateurs marketplace.

---

## Phase 7 : paiements

**Architecture.**
- `checkout_*` (SQL) crée un paiement `pending` dont le montant est calculé par le serveur.
- L'Edge Function `payments` (`action: start`) redirige vers MonCash.
- Au retour, `/dashboard/paiement/retour` appelle `action: verify`. La fonction interroge MonCash côté serveur, puis appelle `confirm_payment` avec la clé service_role.
- La confirmation est idempotente : un même paiement n'active son avantage qu'une fois et ne génère qu'une facture. La correspondance entre commande et transaction est vérifiée, un montant insuffisant est refusé (`failed`).

**Protections.**
- Clé d'idempotence unique.
- Référence prestataire unique, contre le rejeu.
- Réutilisation d'un checkout ouvert, contre les doublons.
- Aucun `INSERT`/`UPDATE` client sur `payments` ou `subscriptions`.
- Une redirection n'est jamais considérée comme une preuve de paiement.

**Prestataires.**

| Prestataire | État |
|---|---|
| MonCash (Digicel) | Adaptateur prêt (`supabase/functions/_shared/payment-providers.ts`), testé avec des réponses simulées. Basé sur la [documentation REST officielle](https://sandbox.moncashbutton.digicelgroup.com/Moncash-business/resources/doc/RestAPI_MonCash_doc.pdf), qui date de **2019**. Les endpoints, la durée de vie du token et les paramètres de l'URL de retour **doivent être revalidés avec Digicel** à l'ouverture du compte marchand. HTG uniquement. Pas de webhook signé documenté : la vérification se fait au retour, avec le bouton « J'ai payé, vérifier ». |
| Virement / espèces | Opérationnel. Un admin confirme avec une référence obligatoire, et l'action est journalisée. |
| Carte bancaire | Non disponible (501). Aucun prestataire n'est encore contracté pour Haïti ; l'interface est prête pour un adaptateur supplémentaire. |
| Simulation | Développement seulement. Elle exige **à la fois** `site_settings.payments_simulation_enabled = true` et `PAYMENTS_MODE=simulation` avec `APP_ENV` différent de `production`. Elle n'est pas proposée dans le build de production. |

**Remboursement.** L'admin retire l'avantage, la facture passe en « remboursée » et l'action est auditée. Le reversement des fonds se fait chez le prestataire.

### Variables d'environnement

Elles sont documentées dans `.env.example`. Les secrets se définissent **uniquement** avec `supabase secrets set`, jamais avec un préfixe `VITE_` :

`APP_ENV`, `PAYMENTS_MODE`, `ALLOWED_ORIGINS`, `MONCASH_CLIENT_ID`, `MONCASH_CLIENT_SECRET`, `MONCASH_MODE`, `PAYMENT_MANUAL_INSTRUCTIONS`.

URL de retour à déclarer dans le portail MonCash : `<VITE_APP_URL>/dashboard/paiement/retour`.

---

## Phase 8 : tests

| Suite | Commande | Résultat |
|---|---|---|
| Unitaires et composants (Vitest) | `npm test` | **32/32** |
| Base de données (Docker, PostgreSQL 16) | `npm run test:db` | **47 scénarios OK**, idempotence et rollbacks OK |
| Typecheck et build de production | `npm run build` | OK |
| Lint | `npm run lint` | OK (1 avertissement préexistant dans `AuthContext.tsx`) |

**Couverture SQL :**
- Rôles : la création de compte ne peut pas obtenir de rôle privilégié ; un utilisateur ne peut pas changer son propre rôle.
- Annonces : isolation entre propriétaires, forçage en `pending`, champs payants protégés, quotas gratuits et par formule.
- Agences et équipe : permissions des agents, nombre de places.
- Prospects et services : contact sans compte, limitation de débit.
- Paiements : montant serveur, réutilisation, interdiction d'écriture côté client, `confirm_payment` réservé à service_role, sous-paiement refusé, idempotence, facture unique.
- Promotions : réservées aux annonces en ligne, interdites sur l'annonce d'un autre.
- Expirations automatiques, essai unique, prorata, renouvellement, remboursement.
- Publicité : compteurs protégés, déduplication.
- Accès réservé aux admins pour l'audit et les rapports ; simulation désactivable.

**Non testé automatiquement.**
- Rendu visuel et responsive : non vérifié dans un navigateur pendant cette session (aucun outil navigateur disponible). À contrôler sur mobile, tablette et ordinateur avant la mise en production.
- Appels réels à MonCash : pas d'identifiants sandbox disponibles.
- Envoi des Edge Functions : `supabase functions deploy payments` n'a pas été exécuté.

---

## Mise en service (ordre recommandé)

1. Staging : `supabase db push` (016 → 018), puis activer **pg_cron** (Database → Extensions) et relancer 017 si nécessaire, ou planifier `select run_marketplace_maintenance()` toutes les 15 minutes.
2. `supabase functions deploy payments` et `supabase secrets set …` (voir la liste ci-dessus).
3. Admin : fixer les prix et activer les formules et offres, vérifier les paramètres (`free_owner_listing_limit` = 3, `free_agency_listing_limit` = 5).
4. Valider le parcours complet en staging : virement manuel, puis MonCash sandbox.
5. Production, avec `payments_simulation_enabled = false` et `APP_ENV=production`.

## Tâches restantes et points d'attention

- **Compte marchand MonCash** : obtenir les identifiants, revalider l'API et tester en sandbox.
- **Paiement par carte** : choisir un prestataire disponible en Haïti, puis ajouter l'adaptateur et un webhook signé.
- **Couleurs** : les jetons `brand-blue` et `brand-yellow` (couleurs du logo) sont ajoutés et utilisés dans les nouveaux éléments. La palette globale existante (navy et or) n'a **pas** été remplacée, pour ne pas altérer l'existant. Une harmonisation complète est possible sur décision.
- **Sitemap** : non généré (application monopage). Un sitemap dynamique (Edge Function) aiderait l'indexation des annonces et des agences.
- **E-mails** : les notifications de paiement et de prospect sont internes à l'application ; il n'y a pas encore d'e-mail.
- Le bouton « Favoris » de la fiche annonce (existant) n'est toujours pas branché ; il n'a pas été modifié.
- L'enum `user_role` n'a pas de valeur `agency_member` : le rôle est porté par `agency_members`.
