/**
 * npm run db:seed — базовое наполнение + учётные записи из .env (SEED_OWNER_*, SEED_MANAGER_*).
 * В продакшне владелец создаётся командой: npm run create-owner -- email@example.kz "Имя"
 */
import "dotenv/config";
import { db } from "@/server/db";
import { hashPassword } from "@/server/auth/password";
import { seedBase } from "./base";

async function ensureStaff(email: string | undefined, password: string | undefined, role: "OWNER" | "MANAGER", name: string) {
  if (!email || !password) return;
  const existing = await db.staffUser.findUnique({ where: { email } });
  if (existing) return;
  await db.staffUser.create({ data: { email, name, role, passwordHash: await hashPassword(password) } });
  console.log(`Создан сотрудник (${role}): ${email}`);
}

async function main() {
  await seedBase();
  await ensureStaff(process.env.SEED_OWNER_EMAIL, process.env.SEED_OWNER_PASSWORD, "OWNER", "Владелец");
  await ensureStaff(process.env.SEED_MANAGER_EMAIL, process.env.SEED_MANAGER_PASSWORD, "MANAGER", "Менеджер");
  console.log("Базовое наполнение готово");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
