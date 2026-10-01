#!/usr/bin/env bash
# Фоновая задача приложения: task.sh notifications | reprice | cleanup
set -uo pipefail
task="${1:?укажите задачу}"
url="${APP_INTERNAL_URL:-http://app:3000}/api/cron/${task}"
stamp() { date '+%F %T'; }

if ! out="$(curl -sS -f -m 300 -X POST -H @/etc/cron.auth "$url" 2>&1)"; then
  echo "$(stamp) [cron:${task}] ошибка: ${out}"
  exit 1
fi
# частые задачи пишут в лог, только когда что-то сделали
case "$task" in
  notifications) [[ "$out" == *'"sent":0,"failed":0'* ]] || echo "$(stamp) [cron:${task}] ${out}" ;;
  reprice) [[ "$out" == *'"changed":0'* ]] || echo "$(stamp) [cron:${task}] ${out}" ;;
  *) echo "$(stamp) [cron:${task}] ${out}" ;;
esac
