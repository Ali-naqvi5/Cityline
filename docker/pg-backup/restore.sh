#!/usr/bin/env bash
# Restore a dump into a target database. Used for the monthly restore test into
# staging (DATA-09) — a backup that has never been restored does not count.
#
#   docker compose run --rm --entrypoint restore.sh backup /backups/daily/cityline-2027....enc cityline_restore_test
set -euo pipefail

FILE="${1:?usage: restore.sh <encrypted-dump> <target-database>}"
TARGET_DB="${2:?usage: restore.sh <encrypted-dump> <target-database>}"
: "${BACKUP_ARCHIVE_PASSWORD:?BACKUP_ARCHIVE_PASSWORD is required}"

if [[ "$TARGET_DB" == "${PGDATABASE:-}" ]]; then
  echo "Refusing to restore over the live database ${TARGET_DB}." >&2
  echo "Restore into a scratch database, check it, then promote deliberately." >&2
  exit 1
fi

echo "[restore] creating ${TARGET_DB}"
createdb "$TARGET_DB"

echo "[restore] restoring ${FILE}"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -pass "env:BACKUP_ARCHIVE_PASSWORD" -in "$FILE" \
  | gunzip \
  | psql --dbname "$TARGET_DB" --set ON_ERROR_STOP=on

echo "[restore] row counts:"
psql --dbname "$TARGET_DB" -c "
  select relname as table, n_live_tup as rows
  from pg_stat_user_tables
  order by n_live_tup desc
  limit 20;"

echo "[restore] done — record the result in docs/runbook-vps.md (DATA-09)"
