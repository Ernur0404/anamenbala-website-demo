import "dotenv/config";
import { execSync } from "node:child_process";

/** Применить миграции к тестовой базе перед запуском тестов */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    console.warn("TEST_DATABASE_URL не задан — интеграционные тесты будут пропущены");
    return;
  }
  execSync("npx prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: url },
  });
}
