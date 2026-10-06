/**
 * Подготовка базы при сборке на Vercel (npm run vercel-build, см. docs/VERCEL.md):
 * проверка настроек → миграции → если база пустая, базовое наполнение и демо-данные.
 * На своём сервере (Docker) не используется — там миграции применяет контейнер migrate.
 */
import "dotenv/config";
import { execSync } from "node:child_process";

function run(command: string) {
  console.log(`\n$ ${command}`);
  execSync(command, { stdio: "inherit" });
}

function fail(problems: string[]): never {
  console.error(
    [
      "",
      "✖ Сайт не готов к запуску на Vercel — не хватает настроек:",
      ...problems.map((p) => `  • ${p}`),
      "",
      "Что сделать — docs/VERCEL.md. После этого: Deployments → … → Redeploy.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

async function main() {
  // предпросмотры (другие ветки) общую базу не меняют
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
    console.log(`Сборка ${process.env.VERCEL_ENV}: база не изменяется`);
    return;
  }

  const problems: string[] = [];
  if (!process.env.DATABASE_URL) problems.push("DATABASE_URL — подключите базу: Storage → Create Database → Neon (Postgres) → Connect к проекту");
  if ((process.env.ENCRYPTION_KEY ?? "").length < 40) problems.push("ENCRYPTION_KEY — ключ шифрования (32 байта в base64)");
  if ((process.env.CRON_SECRET ?? "").length < 16) problems.push("CRON_SECRET — секрет фоновых задач (не короче 16 символов)");
  if (problems.length) fail(problems);

  run("npx prisma migrate deploy");

  const { db } = await import("@/server/db");
  const empty = (await db.category.count()) === 0;
  await db.$disconnect();
  if (!empty) {
    console.log("В базе уже есть данные — наполнение пропущено");
    return;
  }

  console.log("\nБаза пустая — базовое наполнение (категории, настройки, доставка, владелец из SEED_OWNER_*)…");
  run("npx tsx prisma/seed/index.ts");
  if (process.env.DEMO_DATA !== "0") {
    console.log("\nДемо-товары и демо-заказы (удаляются в админке: Настройки → Демо-данные)…");
    run("npx tsx prisma/seed/demo.ts");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
