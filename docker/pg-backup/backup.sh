#!/usr/bin/env bash
# Encrypted pg_dump with 14 daily / 8 weekly / 12 monthly retention (DATA-07),
# copied off-server to HiDrive and to storage outside the IONOS account (DATA-10).
set -euo pipefail

: "${PGDATABASE:?PGDATABASE is required}"
: "${BACKUP_ARCHIVE_PASSWORD:?BACKUP_ARCHIVE_PASSWORD is required}"

STAMP="$(date +%Y%m%d-%H%M%S)"
DAY_OF_WEEK="$(date +%u)"   # 7 = Sunday
DAY_OF_MONTH="$(date +%d)"
DAILY_DIR=/backups/daily
WEEKLY_DIR=/backups/weekly
MONTHLY_DIR=/backups/monthly
FILE="${DAILY_DIR}/${PGDATABASE}-${STAMP}.sql.gz.enc"

mkdir -p "$DAILY_DIR" "$WEEKLY_DIR" "$MONTHLY_DIR"

echo "[backup] dumping ${PGDATABASE}"
pg_dump --format=plain --no-owner --no-privileges \
  | gzip -9 \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt \
      -pass "env:BACKUP_ARCHIVE_PASSWORD" \
      -out "$FILE"

SIZE="$(du -h "$FILE" | cut -f1)"
echo "[backup] wrote ${FILE} (${SIZE})"

# Promote to weekly / monthly before pruning.
[[ "$DAY_OF_WEEK" == "7" ]] && cp "$FILE" "$WEEKLY_DIR/"
[[ "$DAY_OF_MONTH" == "01" ]] && cp "$FILE" "$MONTHLY_DIR/"

prune() {
  local dir="$1" keep="$2"
  ls -1t "$dir"/*.enc 2>/dev/null | tail -n "+$((keep + 1))" | while read -r old; do
    echo "[backup] pruning $(basename "$old")"
    rm -f "$old"
  done
}
prune "$DAILY_DIR" 14
prune "$WEEKLY_DIR" 8
prune "$MONTHLY_DIR" 12

# Off-server copies. Missing remotes are skipped loudly, never silently.
for remote in hidrive b2; do
  case "$remote" in
    hidrive) target="${HIDRIVE_WEBDAV_URL:-}" ; path="hidrive:cityline-backups" ;;
    b2)      target="${B2_BUCKET:-}"          ; path="b2:${B2_BUCKET:-}/cityline-backups" ;;
  esac

  if [[ -z "$target" ]]; then
    echo "[backup] WARNING: ${remote} not configured — no off-server copy there (DATA-10)" >&2
    continue
  fi

  echo "[backup] syncing dumps to ${remote}"
  rclone sync /backups "$path" --transfers 2 --retries 3

  if [[ -d /srv/storage ]]; then
    echo "[backup] syncing uploaded files to ${remote} (DATA-08)"
    rclone sync /srv/storage "${path}-storage" --transfers 4 --retries 3
  fi
done

echo "[backup] done"
