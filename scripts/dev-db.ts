/**
 * Локальный PostgreSQL 18 для разработки — без Docker и прав администратора.
 * Запуск: `npm run db` (держите окно открытым, Ctrl+C — остановка).
 * В продакшне используется обычный PostgreSQL (см. deploy/docker-compose.yml).
 */
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import path from "node:path";

const dataDir = path.resolve(process.env.DEV_PG_DIR ?? ".data/postgres");
const port = Number(process.env.DEV_PG_PORT ?? 5433);
const databases = ["ana_men_bala", "ana_men_bala_test"];

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  port,
  user: "postgres",
  password: "postgres",
  authMethod: "scram-sha-256",
  persistent: true,
  // builtin C.UTF-8: одинаковое поведение на Windows и Linux, корректный lower()/ILIKE для кириллицы
  initdbFlags: ["--encoding=UTF8", "--locale=C", "--locale-provider=builtin", "--builtin-locale=C.UTF-8"],
  onLog: () => {},
  onError: (e) => console.error("[postgres]", e),
});

async function main() {
  if (!existsSync(path.join(dataDir, "PG_VERSION"))) {
    console.log("Инициализация кластера PostgreSQL в", dataDir);
    await pg.initialise();
  }
  await pg.start();

  const client = pg.getPgClient("postgres", "localhost");
  await client.connect();
  for (const name of databases) {
    const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
    if (!rowCount) {
      await client.query(`CREATE DATABASE "${name}"`);
      console.log("Создана база", name);
    }
  }
  await client.end();

  console.log(`PostgreSQL запущен: postgresql://postgres:postgres@localhost:${port}/${databases[0]}`);

  const shutdown = async () => {
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  setInterval(() => {}, 1 << 30);
}

main().catch(async (error) => {
  console.error(error);
  await pg.stop().catch(() => {});
  process.exit(1);
});
