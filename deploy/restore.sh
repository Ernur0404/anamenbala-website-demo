#!/usr/bin/env bash
# Восстановление магазина из резервной копии. Запускать на сервере из папки deploy:
#   ./restore.sh backups/daily/db_2026-10-01_0230.dump              — только база
#   ./restore.sh backups/daily/db_2026-10-01_0230.dump --uploads    — база и фото из снимка того же времени
# Порядок: страховочная копия текущей базы → проверка выбранной копии во временной базе →
# остановка сайта → восстановление → миграции → запуск и проверка.
set -euo pipefail
cd "$(dirname "$0")"

file="${1:?Укажите файл копии, например backups/daily/db_2026-10-01_0230.dump}"
with_uploads="${2:-}"
[ -f "$file" ] || { echo "Файл не найден: $file"; exit 1; }
case "$(realpath "$file")" in
  "$(realpath backups)"/*) ;;
  *) echo "Файл копии должен лежать в папке deploy/backups"; exit 1 ;;
esac
inner="/backups/${file#backups/}"
name="$(basename "$file")"

snapshot=""
if [ "$with_uploads" = "--uploads" ]; then
  stamp="${name#db_}"; stamp="${stamp%.dump}"
  for dir in "backups/uploads/${stamp}" "backups/weekly/uploads_${stamp}"; do
    [ -d "$dir" ] && snapshot="$dir" && break
  done
  [ -n "$snapshot" ] || { echo "Нет снимка фото за ${stamp}"; exit 1; }
fi

echo "Будет восстановлена база из ${name}${snapshot:+ и фото из ${snapshot}}."
echo "Текущие данные будут заменены (перед этим сохранится страховочная копия в backups/safety)."
read -r -p "Продолжить? [y/N] " answer
[[ "$answer" =~ ^[YyДд]$ ]] || { echo "Отменено"; exit 1; }

echo "1/6 Страховочная копия текущей базы…"
docker compose exec -T cron /scripts/backup.sh safety

echo "2/6 Проверка выбранной копии во временной базе…"
docker compose exec -T cron /scripts/restore-check.sh "$inner"

echo "3/6 Остановка сайта…"
docker compose stop app

echo "4/6 Восстановление базы…"
docker compose exec -T cron bash -c 'dropdb --force "$PGDATABASE" && createdb --template=template0 "$PGDATABASE" && pg_restore --no-owner --no-privileges --exit-on-error --dbname="$PGDATABASE" "$1"' _ "$inner"
if [ -n "$snapshot" ]; then
  echo "    …и фото"
  docker compose run --rm --no-deps -v ana-men-bala-uploads:/restore --entrypoint rsync cron -a --delete "/backups/${snapshot#backups/}/" /restore/
fi

echo "5/6 Миграции…"
docker compose run --rm migrate

echo "6/6 Запуск сайта…"
docker compose up -d app
for _ in $(seq 1 30); do
  status="$(docker inspect --format '{{.State.Health.Status}}' "$(docker compose ps -q app)" 2>/dev/null || true)"
  [ "$status" = "healthy" ] && { echo "Готово: сайт работает."; exit 0; }
  sleep 5
done
echo "Сайт не ответил за 2,5 минуты — проверьте: docker compose logs app"
exit 1
