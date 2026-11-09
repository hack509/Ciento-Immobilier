#!/usr/bin/env bash
# Applies every migration on a throw-away PostgreSQL container (with Supabase
# stubs), then runs the SQL security / monetization test-suite.
# Requires Docker. Never touches a real Supabase project.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NAME="ciento-db-test-$$"
IMAGE="${PG_IMAGE:-postgres:16-alpine}"

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run -d --name "$NAME" -e POSTGRES_PASSWORD=test -e POSTGRES_DB=ciento "$IMAGE" >/dev/null

for _ in $(seq 1 30); do
  if docker exec "$NAME" pg_isready -U postgres -d ciento >/dev/null 2>&1; then break; fi
  sleep 1
done
sleep 1

run_sql() {
  local file="$1"
  echo "→ $(basename "$file")"
  docker exec -i "$NAME" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d ciento < "$file"
}

run_sql "$ROOT/supabase/tests/harness/00_supabase_stubs.sql"
for migration in "$ROOT"/supabase/migrations/*.sql; do
  run_sql "$migration"
done

# Re-applying the new migrations must be safe (idempotent DDL).
for migration in "$ROOT"/supabase/migrations/01[6-9]_*.sql; do
  run_sql "$migration" >/dev/null 2>&1
done
echo "→ migrations 016-019 re-applied (idempotence OK)"

for test in "$ROOT"/supabase/tests/sql/*_test.sql; do
  run_sql "$test" 2>&1 | grep -E "PASS|FAIL|ERROR|PASSED|CONTEXT|LINE"
done

# Rollbacks must apply cleanly, newest first.
for rollback in $(ls -r "$ROOT"/supabase/rollbacks/*.down.sql); do
  run_sql "$rollback" >/dev/null
done
echo "→ rollbacks applied cleanly (newest first)"
