#!/usr/bin/env bash
# Apply scripts/reporting-readonly.sql to the production database and create the
# SELECT-only login for Databricks reporting. Run from the repo root:
#
#   bash scripts/apply-reporting-readonly.sh
#
# Uses the Railway CLI (linked to the HR project) to read the Postgres public URL.
# The generated password is written to ~/hr-reporting-readonly.txt (mode 600) and
# never printed. Safe to re-run: views are replaced, an existing role is kept.
set -euo pipefail
cd "$(dirname "$0")/.."

URL=$(railway variables --service Postgres --json | python3 -c 'import sys,json; print(json.load(sys.stdin)["DATABASE_PUBLIC_URL"])')
[ -n "$URL" ] || { echo "Could not read DATABASE_PUBLIC_URL from Railway"; exit 1; }

OUT="$HOME/hr-reporting-readonly.txt"
if [ -f "$OUT" ]; then
  PASSWORD=$(sed -n 's/^password: //p' "$OUT")
else
  PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-28)
fi

if psql "$URL" -Atc "select 1 from pg_roles where rolname='reporting_readonly'" | grep -q 1; then
  echo "Role reporting_readonly already exists; keeping its password."
  ROLE_EXISTED=1
else
  ROLE_EXISTED=0
fi

sed "s/REPLACE_ME/$PASSWORD/" scripts/reporting-readonly.sql | psql "$URL" -v ON_ERROR_STOP=1 -q
echo "Schema 'reporting' and views applied."

HOSTPORT=$(python3 -c 'import sys; from urllib.parse import urlparse; u=urlparse(sys.argv[1]); print(f"{u.hostname}:{u.port} db={u.path.lstrip(chr(47))}")' "$URL")
if [ "$ROLE_EXISTED" = "0" ] || [ ! -f "$OUT" ]; then
  umask 077
  {
    echo "HR reporting read-only login (SELECT on schema 'reporting' only)"
    echo "host/port/db: $HOSTPORT"
    echo "user: reporting_readonly"
    echo "password: $PASSWORD"
    echo "sslmode: require"
  } > "$OUT"
  echo "Connection details for Evgeny saved to $OUT"
fi

echo "--- check"
psql "$URL" -Atc "select table_name from information_schema.views where table_schema='reporting' order by 1" | sed 's/^/  view: /'
