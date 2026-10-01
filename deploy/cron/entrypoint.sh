#!/usr/bin/env bash
set -euo pipefail

TZ="${TZ:-Asia/Atyrau}"
ln -snf "/usr/share/zoneinfo/${TZ}" /etc/localtime
echo "${TZ}" > /etc/timezone

# cron не передаёт переменные окружения задачам — сохраняем нужные в файл (доступен только root)
umask 077
: > /etc/cron.env
for name in TZ PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE APP_INTERNAL_URL BACKUP_KEEP_DAILY BACKUP_KEEP_WEEKLY; do
  if [ -n "${!name:-}" ]; then printf 'export %s=%q\n' "$name" "${!name}" >> /etc/cron.env; fi
done
# секрет для /api/cron/* — в отдельном файле заголовка, чтобы не светился в списке процессов
printf 'Authorization: Bearer %s\n' "${CRON_SECRET:?CRON_SECRET не задан}" > /etc/cron.auth

mkdir -p /backups/daily /backups/weekly /backups/uploads /backups/safety
echo "$(date '+%F %T') [cron] запущен, часовой пояс ${TZ}"
exec cron -f
