# Rapport de revue de sécurité Supabase

## Périmètre et état

Les migrations `001` à `013` ont été examinées dans l'ordre. Selon la
confirmation de l'équipe, elles sont appliquées au projet
`mbmjbkrnsxtdnatsulur`; leur état distant n'a pas été vérifié directement.
Le projet de destination est maintenant celui de `.env`,
`drznswhwmnipsqycbjmp`. Il s'agit d'une référence différente et l'état de ses
migrations est inconnu. L'historique existant a été conservé ; les corrections
sont regroupées dans [`014_security_hardening.sql`](./migrations/014_security_hardening.sql).
Aucune migration n'a été exécutée à distance.

## Inventaire des migrations initiales

| Migration | Rôle |
|---|---|
| `001_create_extensions.sql` | Extensions PostgreSQL |
| `002_create_enums.sql` | Types énumérés du domaine |
| `003_create_tables.sql` | Tables et relations |
| `004_create_indexes.sql` | Index de recherche et de relation |
| `005_create_rls_policies.sql` | RLS et politiques initiales |
| `006_create_functions.sql` | Fonctions et triggers métier |
| `007_seed_data.sql` | Données initiales |
| `008_create_newsletter.sql` | Abonnés et règles initiales de newsletter |
| `009_fix_newsletter_rls.sql` | Correctif RLS newsletter |
| `010_create_storage_buckets.sql` | Bucket et politiques Storage |
| `011_auto_create_profile.sql` | Création automatique du profil |
| `012_security_fixes.sql` | Correctifs de privilèges, RLS et stockage |
| `013_messaging_rpc.sql` | RPC de messagerie |

## Problèmes relevés et corrections

| Problème | Correction préparée |
|---|---|
| Lecture publique de tous les profils | Retrait de la politique publique sur `profiles`; accès direct réservé au propriétaire et à l'administration. Une vue publique ne sélectionne que les champs de présentation des profils actifs associés à une activité publique. |
| Images de brouillons accessibles publiquement | Le bucket devient privé. Les politiques Storage autorisent les images d'annonces publiées et celles du propriétaire; l'application génère des URL signées à durée limitée. |
| Inscription/désinscription newsletter sans preuve de contrôle | Suppression des écritures directes depuis le navigateur. Les nouvelles Edge Functions utilisent Resend pour envoyer un lien de confirmation; les jetons sont stockés sous forme d'empreinte SHA-256, expirent après sept jours, invalident les anciens jetons à l'émission et ne sont consommables qu'une fois. L'émission est réservée à `service_role`; des limites de fréquence sont appliquées par adresse et IP. |
| Auto-vérification d'une agence ou d'un agent | Des triggers empêchent les propriétaires de définir les champs de vérification, de note et de compteurs. Les champs sont initialisés à des valeurs non vérifiées lors de la création. |
| Publication d'annonce par son propriétaire | Les annonces créées par un utilisateur sont forcées en `pending`, non publiées et non mises en avant. Seul un administrateur peut modifier les champs de modération. Le formulaire ne propose plus la publication directe. |
| Modifications arbitraires de rendez-vous | Les triggers limitent les participants à la transition de statut autorisée et interdisent la modification des détails du rendez-vous. Les transitions du demandeur et de l'agent sont contrôlées séparément. |
| Exécution de journaux d'activité falsifiables par les clients | La politique d'insertion publique est supprimée. Les écritures doivent provenir d'un contexte serveur de confiance. |
| Fonctions `SECURITY DEFINER` avec `search_path` insuffisamment strict | Les fonctions métier et RPC concernées utilisent désormais un `search_path` vide et des références qualifiées; les droits d'exécution des fonctions de trigger sont retirés aux rôles clients. |

## Matrice de tests attendue

Les résultats ci-dessous sont des attentes de sécurité, pas des tests exécutés.

| Scénario | Résultat attendu | Résultat |
|---|---|---|
| Anonyme lit directement les profils | Refusé | Non exécuté |
| Utilisateur A lit son propre profil | Autorisé | Non exécuté |
| Utilisateur A lit les données privées de B | Refusé | Non exécuté |
| Utilisateur change son rôle ou son état de vérification | Refusé | Non exécuté |
| Anonyme liste ou télécharge une image de brouillon | Refusé | Non exécuté |
| Visiteur accède à une image d'annonce publiée via URL signée | Autorisé | Non exécuté |
| Désinscription avec jeton invalide, expiré ou déjà consommé | Refusé | Non exécuté |
| Propriétaire modifie note, compteur ou validation agent/agence | Refusé | Non exécuté |
| Propriétaire publie ou met en avant sa propre annonce | Refusé | Non exécuté |
| Administrateur approuve une annonce | Autorisé | Non exécuté |
| Demandeur confirme ou termine son rendez-vous | Refusé | Non exécuté |
| Agent affecté confirme puis termine un rendez-vous | Autorisé selon transition | Non exécuté |
| Participant modifie les détails ou l'affectation d'un rendez-vous | Refusé | Non exécuté |

## Validation effectuée

- `npm run build` : réussi.
- `npm run lint` : réussi; un avertissement existant `react(only-export-components)`
  apparaît dans `src/contexts/AuthContext.tsx`.
- `git diff --check` et vérifications simples de délimiteurs SQL : réussis.
- Aucun parseur PostgreSQL (`psql`/Supabase CLI) n'est disponible dans cet
  environnement; le moteur Docker local n'est pas démarré. La syntaxe et les
  comportements SQL n'ont donc pas été validés par PostgreSQL.
- Le runner de tests n'a trouvé aucun test dans le dépôt. Deno n'est pas
  installé; les Edge Functions n'ont donc pas été vérifiées par `deno check`.
- Aucun test RLS multi-identités, appel RPC, accès Storage ou test distant n'a
  été exécuté.

## Conditions avant application

1. Vérifier les doublons d'adresses newsletter insensibles à la casse avant la
   création de l'index unique :

   ```sql
   SELECT lower(email), count(*)
   FROM public.newsletter_subscribers
   GROUP BY lower(email)
   HAVING count(*) > 1;
   ```

   Si cette requête retourne des lignes, réconcilier ces données avant
   d'appliquer la migration; celle-ci ne supprime aucune inscription.
2. Vérifier l'historique du projet cible `drznswhwmnipsqycbjmp` avant toute
   migration. N'appliquer que 014 si 001-013 y sont déjà appliquées; s'il est
   neuf, appliquer l'ensemble dans l'ordre. Ne pas supposer que l'historique
   de `mbmjbkrnsxtdnatsulur` s'applique à ce projet.
3. Vérifier les relations PostgREST de la vue `public_profiles` et les tests
   fonctionnels avec des comptes distincts sur un projet de préproduction.
4. Configurer `RESEND_API_KEY` et `NEWSLETTER_FROM_EMAIL` dans les secrets des
   Edge Functions Supabase et vérifier le domaine d'envoi Resend. Déployer
   `newsletter-subscribe` et `newsletter-manage`; ne jamais exposer la clé
   `service_role` dans le navigateur.
5. `.env` et `supabase/config.toml` pointent maintenant vers
   `drznswhwmnipsqycbjmp`. La clé publishable est utilisée par le frontend
   depuis `.env`; elle n'est pas copiée dans la configuration CLI.
6. Vérifier depuis Supabase que le compte administrateur initial a été
   configuré via un canal de confiance.

## Limites

La migration 014, les fonctions Edge et les modifications frontend sont
préparées mais non déployées. Les tests PostgreSQL/RLS, l'envoi réel via Resend,
les relations de la vue et la compatibilité effective avec l'état distant
restent à valider avant la production.
