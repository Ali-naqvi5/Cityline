#!/usr/bin/env bash
# Runs backup.sh once a day at BACKUP_HOUR (local time, Europe/London).
# A plain sleep loop rather than cron, so failures land in `docker logs`.
set -euo pipefail

BACKUP_HOUR="${BACKUP_HOUR:-3}"
BACKUP_MINUTE="${BACKUP_MINUTE:-15}"

configure_rclone() {
  mkdir -p /root/.config/rclone
  : >/root/.config/rclone/rclone.conf

  if [[ -n "${HIDRIVE_WEBDAV_URL:-}" ]]; then
    cat >>/root/.config/rclone/rclone.conf <<CONF
[hidrive]
type = webdav
url = ${HIDRIVE_WEBDAV_URL}
vendor = other
user = ${HIDRIVE_USER:-}
pass = $(rclone obscure "${HIDRIVE_PASSWORD:-}")
CONF
  fi

  if [[ -n "${B2_KEY_ID:-}" ]]; then
    cat >>/root/.config/rclone/rclone.conf <<CONF
[b2]
type = b2
account = ${B2_KEY_ID}
key = ${B2_APP_KEY:-}
CONF
  fi
}

seconds_until_next_run() {
  local now target
  now=$(date +%s)
  target=$(date -d "today ${BACKUP_HOUR}:${BACKUP_MINUTE}" +%s 2>/dev/null || echo 0)
  if [[ "$target" -le "$now" ]]; then
    target=$(date -d "tomorrow ${BACKUP_HOUR}:${BACKUP_MINUTE}" +%s)
  fi
  echo $((target - now))
}

configure_rclone
echo "[backup] scheduled daily at ${BACKUP_HOUR}:${BACKUP_MINUTE} Europe/London"

while true; do
  sleep "$(seconds_until_next_run)"
  if ! /usr/local/bin/backup.sh; then
    echo "[backup] FAILED — a backup that does not run is not a backup (DATA-09)" >&2
  fi
done
