# Фоновые задачи и бэкапы: pg_dump/pg_restore той же версии, что и сервер базы (18), cron, rsync, curl
FROM postgres:18
RUN apt-get update \
  && apt-get install -y --no-install-recommends cron curl rsync tzdata ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY crontab /etc/cron.d/ana-men-bala
COPY entrypoint.sh task.sh backup.sh restore-check.sh /scripts/
RUN chmod 0644 /etc/cron.d/ana-men-bala && chmod 0755 /scripts/*.sh
ENTRYPOINT ["/scripts/entrypoint.sh"]
