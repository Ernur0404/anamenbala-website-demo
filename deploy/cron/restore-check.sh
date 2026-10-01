#!/usr/bin/env bash
# Проверка, что копия базы восстанавливается: разворачивает её во временную базу, считает данные и удаляет.
#   docker compose exec cron /scripts/restore-check.sh                       — последняя ежедневная копия
#   docker compose exec cron /scripts/restore-check.sh /backups/daily/db_….dump
set -euo pipefail

file="${1:-$(find /backups/daily -maxdepth 1 -name 'db_*.dump' | sort | tail -n 1)}"
log() { echo "$(date '+%F %T') [restore-check] $*"; }
if [ -z "$file" ] || [ ! -f "$file" ]; then
  log "ОШИБКА: файл копии не найден (${file:-нет копий})"
  exit 1
fi

db="restore_check_$(date +%s)"
cleanup() { dropdb --if-exists --force "$db" >/dev/null 2>&1 || true; }
trap cleanup EXIT

createdb --template=template0 "$db"
if ! pg_restore --no-owner --no-privileges --exit-on-error --dbname="$db" "$file" 2>/tmp/restore-check.err; then
  log "ОШИБКА: $(basename "$file") не восстанавливается: $(tail -n 3 /tmp/restore-check.err)"
  exit 1
fi
summary="$(psql -d "$db" -At -c 'SELECT (SELECT count(*) FROM "Product") || '' товаров, '' || (SELECT count(*) FROM "Order") || '' заказов, '' || (SELECT count(*) FROM "Customer") || '' клиентов, миграций: '' || (SELECT count(*) FROM "_prisma_migrations")')"
log "OK: $(basename "$file") → ${summary}"
