import { z } from "zod";

/** Публичный адрес сайта без слэша в конце: APP_URL → адрес проекта на Vercel → localhost */
export function defaultAppUrl(): string {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return vercel ? `https://${vercel}` : "http://localhost:3000";
}

/**
 * Строка подключения к PostgreSQL: DATABASE_URL, иначе переменные интеграций Vercel
 * (Neon / Supabase / Vercel Postgres задают POSTGRES_PRISMA_URL и POSTGRES_URL)
 */
export function databaseUrl(): string {
  const candidates = [process.env.DATABASE_URL, process.env.POSTGRES_PRISMA_URL, process.env.POSTGRES_URL];
  return withLibpqSsl(candidates.find((url) => url && /^postgres(ql)?:\/\//.test(url)) ?? "");
}

/**
 * pg (node-postgres) считает sslmode=require полной проверкой сертификата, а хостинги (Supabase и др.)
 * пишут его в смысле libpq — «шифровать без проверки»: их сертификат подписан собственным центром,
 * и строгая проверка обрывает соединение. Включаем совместимость с libpq для prefer/require.
 */
export function withLibpqSsl(url: string): string {
  if (!/[?&]sslmode=(prefer|require)(&|$)/.test(url) || /[?&]uselibpqcompat=/.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}uselibpqcompat=true`;
}

export function appUrl(): string {
  return (process.env.APP_URL || defaultAppUrl()).replace(/\/$/, "");
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.preprocess(() => databaseUrl(), z.string().min(1, "DATABASE_URL не задан")),
  // на Vercel без APP_URL — адрес проекта (VERCEL_PROJECT_PRODUCTION_URL)
  APP_URL: z.preprocess((value) => value || defaultAppUrl(), z.string().url()),
  // секреты необязательны для запуска: без ключа нельзя сохранить токен Telegram и включить 2FA,
  // без CRON_SECRET фоновые задачи отклоняются (см. crypto.ts и api/cron)
  ENCRYPTION_KEY: z
    .string()
    .default("")
    .refine((v) => v === "" || v.length >= 40, "ENCRYPTION_KEY: 32 байта в base64"),
  CRON_SECRET: z
    .string()
    .default("")
    .refine((v) => v === "" || v.length >= 16, "CRON_SECRET слишком короткий"),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  UPLOAD_DIR: z.string().default("./storage/uploads"),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_PUBLIC_URL: z.string().optional(),
  SMTP_URL: z.string().optional().default(""),
  MAIL_FROM: z.string().default("Ана мен бала <no-reply@localhost>"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/** Переменные окружения проверяются при первом обращении (не во время сборки) */
export function env(): Env {
  if (!cached) {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      throw new Error(`Некорректные переменные окружения: ${issues}`);
    }
    cached = parsed.data;
  }
  return cached;
}

export const isProduction = () => process.env.NODE_ENV === "production";
