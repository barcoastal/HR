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
  echo "Role reporting_readonly already exists; setting its password to the one in $OUT."
fi

sed "s/REPLACE_ME/$PASSWORD/" scripts/reporting-readonly.sql | psql "$URL" -v ON_ERROR_STOP=1 -q
echo "Schema 'reporting' and views applied."

HOST=$(python3 -c 'import sys; from urllib.parse import urlparse; print(urlparse(sys.argv[1]).hostname)' "$URL")
PORT=$(python3 -c 'import sys; from urllib.parse import urlparse; print(urlparse(sys.argv[1]).port)' "$URL")
DBNAME=$(python3 -c 'import sys; from urllib.parse import urlparse; print(urlparse(sys.argv[1]).path.lstrip("/"))' "$URL")
umask 077
{
  echo "HR reporting read-only login (SELECT on schema 'reporting' only)"
  echo "host/port/db: $HOST:$PORT db=$DBNAME"
  echo "user: reporting_readonly"
  echo "password: $PASSWORD"
  echo "sslmode: require"
} > "$OUT"
echo "Connection details for Evgeny saved to $OUT"

# Prove the saved login works before handing it over.
if PGPASSWORD="$PASSWORD" psql "host=$HOST port=$PORT dbname=$DBNAME user=reporting_readonly sslmode=require" -Atc "select count(*) from reporting.positions" >/dev/null 2>&1; then
  echo "Login check: reporting_readonly can connect and read schema 'reporting'."
else
  echo "Login check FAILED: reporting_readonly could not connect with the saved password." >&2
  exit 1
fi

echo "--- check"
psql "$URL" -Atc "select table_name from information_schema.views where table_schema='reporting' order by 1" | sed 's/^/  view: /'
