import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // миграции — по прямому подключению, если хостинг его даёт (Neon на Vercel: DATABASE_URL_UNPOOLED,
    // Supabase / Vercel Postgres: POSTGRES_URL_NON_POOLING); иначе — обычная строка подключения
    url:
      process.env["DATABASE_URL_UNPOOLED"] ||
      process.env["POSTGRES_URL_NON_POOLING"] ||
      process.env["DATABASE_URL"] ||
      process.env["POSTGRES_PRISMA_URL"] ||
      process.env["POSTGRES_URL"],
  },
});
