/**
 * Подготовка базы при сборке на Vercel (npm run vercel-build, см. docs/VERCEL.md):
 * проверка базы → миграции → если база пустая, базовое наполнение и демо-данные → владелец из SEED_OWNER_*.
 * На своём сервере (Docker) не используется — там миграции применяет контейнер migrate.
 */
import "dotenv/config";
import { execSync } from "node:child_process";
import { databaseUrl } from "@/server/env";

function run(command: string, env: NodeJS.ProcessEnv = process.env) {
  console.log(`\n$ ${command}`);
  execSync(command, { stdio: "inherit", env });
}

/** Наполнение без учётных записей: владельца создаёт ensureOwner (email строчными, проверка пароля) */
function seedEnv(): NodeJS.ProcessEnv {
  // пустые значения, а не удаление: иначе dotenv в дочернем процессе подставит их из .env
  return { ...process.env, SEED_OWNER_EMAIL: "", SEED_OWNER_PASSWORD: "", SEED_MANAGER_EMAIL: "", SEED_MANAGER_PASSWORD: "" };
}

function fail(lines: string[]): never {
  console.error(["", "✖ Сайт не готов к запуску на Vercel:", ...lines.map((l) => `  ${l}`), "", "Подробно — docs/VERCEL.md.", ""].join("\n"));
  process.exit(1);
}

/** Владелец для входа в админку — из SEED_OWNER_EMAIL / SEED_OWNER_PASSWORD (создаётся один раз) */
async function ensureOwner() {
  const email = process.env.SEED_OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_OWNER_PASSWORD ?? "";
  if (!email || !password) {
    console.log("\nВход в админку: добавьте SEED_OWNER_EMAIL и SEED_OWNER_PASSWORD и сделайте Redeploy — владелец создастся.");
    return;
  }
  const [{ db }, { hashPassword, passwordProblems }] = await Promise.all([import("@/server/db"), import("@/server/auth/password")]);
  try {
    if (await db.staffUser.findUnique({ where: { email } })) return;
    if (passwordProblems(password)) {
      console.warn("\n⚠ SEED_OWNER_PASSWORD слишком простой (нужно от 8 символов, буквы и цифры) — владелец не создан.");
      return;
    }
    await db.staffUser.create({ data: { email, name: "Владелец", role: "OWNER", passwordHash: await hashPassword(password) } });
    console.log("\nВладелец для входа в админку создан.");
  } finally {
    await db.$disconnect();
  }
}

async function main() {
  // предпросмотры (другие ветки) общую базу не меняют
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
    console.log(`Сборка ${process.env.VERCEL_ENV}: база не изменяется`);
    return;
  }

  if (!databaseUrl()) {
    fail([
      "Не подключена база данных PostgreSQL.",
      "Vercel → проект → Storage → Create Database → Neon (Serverless Postgres) → Create →",
      "Connect к этому проекту, затем Deployments → ⋯ → Redeploy.",
    ]);
  }
  for (const [name, hint] of [
    ["ENCRYPTION_KEY", "без него нельзя сохранить токен Telegram и включить 2FA"],
    ["CRON_SECRET", "без него не работают фоновые задачи (пересчёт акций, очистка)"],
  ] as const) {
    if (!process.env[name]) console.warn(`⚠ ${name} не задан — ${hint} (см. docs/VERCEL.md)`);
  }

  const source = ["DATABASE_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL"].find((key) => /^postgres(ql)?:\/\//.test(process.env[key] ?? ""));
  const host = databaseUrl().match(/@([^/:?]+)/)?.[1] ?? "?";
  console.log(`База: ${source} → ${host}`);

  run("npx prisma migrate deploy");

  const { db } = await import("@/server/db");
  let empty: boolean;
  try {
    empty = (await db.category.count()) === 0;
  } catch (error) {
    const code = (error as { code?: string }).code ?? "";
    fail([`Не удалось подключиться к базе ${host}${code ? ` (${code})` : ""}:`, String((error as Error).message ?? error).split("\n")[0]]);
  } finally {
    await db.$disconnect();
  }
  if (empty) {
    console.log("\nБаза пустая — базовое наполнение (категории, настройки, доставка и оплата)…");
    run("npx tsx prisma/seed/index.ts", seedEnv());
    if (process.env.DEMO_DATA !== "0") {
      console.log("\nДемо-товары и демо-заказы (удаляются в админке: Настройки → Демо-данные)…");
      run("npx tsx prisma/seed/demo.ts", seedEnv());
    }
  } else {
    console.log("\nВ базе уже есть данные — наполнение пропущено");
  }

  await ensureOwner();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
