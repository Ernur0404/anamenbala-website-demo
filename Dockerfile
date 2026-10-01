# syntax=docker/dockerfile:1.7
# Образы приложения «Ана мен бала». Собираются через deploy/docker-compose.yml (см. docs/DEPLOY.md).
#   runner — рабочий сервер (standalone-сборка Next.js)
#   tools  — миграции, начальное наполнение, создание владельца и другие служебные команды

ARG NODE_IMAGE=node:24-bookworm-slim

# ── зависимости: все пакеты (dev-пакеты нужны для сборки, миграций и служебных команд)
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
# postinstall: prisma generate → src/generated/prisma
RUN npm ci --no-audit --no-fund

# ── сборка приложения (переменные окружения при сборке не нужны: база и секреты читаются при запуске)
FROM deps AS builder
COPY . .
RUN npm run build

# ── служебный образ
FROM builder AS tools
ENV NODE_ENV=production
CMD ["npx", "prisma", "migrate", "deploy"]

# ── рабочий образ
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    UPLOAD_DIR=/app/storage/uploads
RUN groupadd --system --gid 1001 app \
  && useradd --system --uid 1001 --gid app --home-dir /app app \
  && mkdir -p /app/storage/uploads \
  && chown -R app:app /app/storage
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/public ./public
# нативные модули (обработка фото, пароли) — целиком, с бинарниками под платформу сервера
COPY --from=deps --chown=app:app /app/node_modules/sharp ./node_modules/sharp
COPY --from=deps --chown=app:app /app/node_modules/@img ./node_modules/@img
COPY --from=deps --chown=app:app /app/node_modules/@node-rs ./node_modules/@node-rs
USER app
EXPOSE 3000
CMD ["node", "server.js"]
