# Tests base de données

`npm run test:db` (Docker requis) :

1. démarre un PostgreSQL 16 jetable avec des stubs Supabase (`harness/00_supabase_stubs.sql` : rôles `anon` / `authenticated` / `service_role`, `auth.uid()`, schéma `storage`) ;
2. applique les migrations `001` → `018`, puis ré-applique `016`–`018` (idempotence) ;
3. exécute `sql/marketplace_security_test.sql` (RLS, rôles, quotas, paiements, promotions, expirations, audit) ;
4. applique les rollbacks `018` → `016`.

Le conteneur est supprimé à la fin. Aucun projet Supabase réel n'est touché.
Avec la CLI Supabase, les mêmes scénarios peuvent tourner sur `supabase start`.
