#!/usr/bin/env bash
#
# Runs ON THE VPS, called over SSH by .github/workflows/deploy.yml.
# Install at /srv/cityline/deploy.sh (chmod +x).
#
# Order matters (PRD-05): dump the database, migrate, replace only the app and
# worker containers, health-check, roll back on failure. The pg_data and storage
# volumes are never touched.

set -euo pipefail

APP_DIR=/srv/cityline
LAST_GOOD_FILE="${APP_DIR}/.last-good-tag"
HEALTH_RETRIES=20
HEALTH_DELAY=3

: "${APP_TAG:?APP_TAG must be set by the deploy workflow}"
cd "$APP_DIR"

log() { echo "[deploy $(date -Is)] $*"; }

health_ok() {
  docker compose exec -T app node -e "
    fetch('http://127.0.0.1:3000/api/health')
      .then(r => r.json())
      .then(b => process.exit(b.status === 'ok' ? 0 : 1))
      .catch(() => process.exit(1))
  " >/dev/null 2>&1
}

wait_for_health() {
  for _ in $(seq 1 "$HEALTH_RETRIES"); do
    if health_ok; then return 0; fi
    sleep "$HEALTH_DELAY"
  done
  return 1
}

rollback() {
  if [[ ! -f "$LAST_GOOD_FILE" ]]; then
    log "FAILED and no previous good tag recorded — manual intervention needed"
    exit 1
  fi
  local previous
  previous="$(cat "$LAST_GOOD_FILE")"
  log "rolling back to ${previous}"
  APP_TAG="$previous" docker compose up -d app worker
  wait_for_health && log "rollback healthy" || log "ROLLBACK UNHEALTHY — page someone"
  exit 1
}

log "deploying ${APP_TAG}"

log "pulling image"
APP_TAG="$APP_TAG" docker compose pull app worker

log "dumping database before migrating (PRD-05)"
docker compose exec -T db pg_dump -U "${POSTGRES_USER:-cityline}" \
  | gzip > "${APP_DIR}/pre-deploy-$(date +%Y%m%d-%H%M%S).sql.gz"
# Keep the last 10 pre-deploy dumps; the nightly encrypted backups are the real archive.
ls -1t "${APP_DIR}"/pre-deploy-*.sql.gz | tail -n +11 | xargs -r rm -f

# TODO(S8): once Payload is installed, run migrations here before starting the
# new containers — `docker compose run --rm app node dist/migrate.js`.
# Migrations only add (DATA-04); never add a destructive step to this script.

log "replacing app and worker containers only"
APP_TAG="$APP_TAG" docker compose up -d app worker

log "waiting for health"
if wait_for_health; then
  echo "$APP_TAG" > "$LAST_GOOD_FILE"
  log "deployed ${APP_TAG}"
else
  log "health check failed"
  rollback
fi
