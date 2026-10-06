# Ана мен бала — интернет-магазин и админ-панель

Магазин товаров для мам, детей и дома (с. Ганюшкино): витрина на русском и казахском, корзина и
оформление заказа, кабинет покупателя и админ-панель для владельца — товары, остатки, заказы,
касса, акции, баннеры, контент, отчёты и настройки.

- **Владельцу:** [docs/ADMIN-GUIDE.md](docs/ADMIN-GUIDE.md) — как работать в админ-панели.
- **Запуск на сервере:** [docs/DEPLOY.md](docs/DEPLOY.md) — Docker, HTTPS, бэкапы, восстановление.
- **Демо на Vercel:** [docs/VERCEL.md](docs/VERCEL.md) — база Neon, настройки, что происходит при сборке.

## Стек

Next.js 16 (App Router, Server Components, Server Actions) · React 19 · TypeScript ·
PostgreSQL 18 + Prisma 7 · Tailwind CSS 4 · next-intl (RU/KZ) · Zod · Radix UI · Tiptap ·
Recharts · exceljs · sharp · Vitest. Продакшн — Docker Compose: приложение, PostgreSQL, Caddy,
cron-контейнер (фоновые задачи и бэкапы).

## Локальная разработка

Нужен Node.js 24 LTS. Docker и установленный PostgreSQL не требуются — база для разработки
запускается из npm-пакета.

```bash
npm install
cp .env.example .env          # заполните ENCRYPTION_KEY и CRON_SECRET (команды — в файле)
# DATABASE_URL для локальной базы: postgresql://postgres:postgres@localhost:5433/ana_men_bala
# TEST_DATABASE_URL (тесты):       postgresql://postgres:postgres@localhost:5433/ana_men_bala_test

npm run db                    # отдельное окно: PostgreSQL 18 на порту 5433 (Ctrl+C — остановка)
npm run db:deploy             # миграции
npm run db:seed               # категории, характеристики, доставка/оплата, страницы, настройки
npm run db:demo               # демо-каталог и демо-заказы (по желанию)
npm run create-owner -- you@example.kz "Имя"   # владелец (временный пароль выводится один раз)
npm run dev                   # http://localhost:3000 и http://localhost:3000/admin
```

## Команды

| Команда | Что делает |
|---|---|
| `npm run dev` / `build` / `start` | разработка / продакшн-сборка / запуск сборки |
| `npm run typecheck` · `npm run lint` | проверка типов · ESLint |
| `npm test` | тесты (Vitest): цены и акции, заказы и остатки, фоновые задачи, импорт Excel |
| `npm run db:migrate` | новая миграция после изменения `prisma/schema.prisma` |
| `npm run db:studio` | просмотр базы (Prisma Studio) |
| `npm run reindex` | пересчитать цены, фильтры и поиск всех товаров |

Интеграционные тесты работают с отдельной базой `TEST_DATABASE_URL` (очищается перед каждым тестом);
без неё они пропускаются.

## Структура

```
src/app/[locale]/(store)/   витрина (русский — без префикса, казахский — /kk/…)
src/app/admin/              админ-панель (вход, (panel)/… — разделы)
src/app/api/                загрузка файлов, выгрузки Excel, /api/cron/*, /api/health
src/server/                 бизнес-логика: заказы, цены, склад, каталог, уведомления, настройки…
src/server/actions/         server actions (витрина и админка) — проверка прав и данных
src/components/             ui (общие), store (витрина), admin (админка)
messages/                   тексты интерфейса: ru.json / kk.json (витрина), admin/{ru,kk}/ (админка)
prisma/                     схема, миграции, начальное наполнение и демо-данные
deploy/                     Docker Compose, Caddy, cron и скрипты бэкапа / восстановления
tests/                      интеграционные тесты
```

Ключевые правила: остатки меняются только через сервис склада (`src/server/stock.ts`) с записью
в журнал; цена товара считается одной функцией (`src/server/pricing/engine.ts`); каждое действие
админки проверяет права на сервере (`src/server/permissions.ts`) и пишется в журнал действий.
