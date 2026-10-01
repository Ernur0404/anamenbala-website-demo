#!/usr/bin/env bash
# Резервная копия: база (pg_dump) + загруженные фото и видео (снимок rsync).
# Хранение: BACKUP_KEEP_DAILY ежедневных (14) и BACKUP_KEEP_WEEKLY еженедельных (8, по воскресеньям).
#   docker compose exec cron /scripts/backup.sh          — сделать копию сейчас
#   docker compose exec cron /scripts/backup.sh safety   — страховочная копия базы перед восстановлением
set -euo pipefail

ROOT=/backups
KEEP_DAILY="${BACKUP_KEEP_DAILY:-14}"
KEEP_WEEKLY="${BACKUP_KEEP_WEEKLY:-8}"
stamp="$(date +%Y-%m-%d_%H%M)"
log() { echo "$(date '+%F %T') [backup] $*"; }

# дамп базы в custom-формате (сжатый; восстанавливается pg_restore)
dump_db() {
  local target="$1" partial
  partial="$(dirname "$target")/.$(basename "$target").partial"
  pg_dump --format=custom --compress=6 --no-owner --no-privileges --file="$partial"
  mv "$partial" "$target"
}

# оставить N самых новых записей (имена начинаются с даты — сортировка по имени = по времени)
prune() {
  local dir="$1" pattern="$2" keep="$3"
  find "$dir" -mindepth 1 -maxdepth 1 -name "$pattern" | sort | head -n -"$keep" | xargs -r rm -rf --
}

mkdir -p "$ROOT/daily" "$ROOT/weekly" "$ROOT/uploads" "$ROOT/safety"

if [ "${1:-}" = "safety" ]; then
  dump_db "$ROOT/safety/db_${stamp}.dump"
  prune "$ROOT/safety" "db_*.dump" 5
  log "страховочная копия: safety/db_${stamp}.dump"
  exit 0
fi

# 1. база
dump_db "$ROOT/daily/db_${stamp}.dump"

# 2. фото: неизменённые файлы — жёсткие ссылки на прошлый снимок (место на диске не занимают)
last="$(find "$ROOT/uploads" -mindepth 1 -maxdepth 1 -type d -name '20*' | sort | tail -n 1)"
rsync -a --delete ${last:+--link-dest="$last"} /uploads/ "$ROOT/uploads/.${stamp}.partial/"
mv "$ROOT/uploads/.${stamp}.partial" "$ROOT/uploads/${stamp}"

# 3. еженедельные копии (воскресенье): база и снимок фото (жёсткие ссылки)
if [ "$(date +%u)" = "7" ]; then
  cp "$ROOT/daily/db_${stamp}.dump" "$ROOT/weekly/db_${stamp}.dump"
  cp -al "$ROOT/uploads/${stamp}" "$ROOT/weekly/uploads_${stamp}"
fi

# 4. ротация
prune "$ROOT/daily" "db_*.dump" "$KEEP_DAILY"
prune "$ROOT/uploads" "20*" "$KEEP_DAILY"
prune "$ROOT/weekly" "db_*.dump" "$KEEP_WEEKLY"
prune "$ROOT/weekly" "uploads_*" "$KEEP_WEEKLY"

log "готово: daily/db_${stamp}.dump ($(du -h "$ROOT/daily/db_${stamp}.dump" | cut -f1)), фото uploads/${stamp}; всего $(du -sh "$ROOT" | cut -f1)"
