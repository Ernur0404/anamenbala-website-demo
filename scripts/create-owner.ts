/**
 * Создать (или сбросить пароль) владельца магазина.
 *   npm run create-owner -- owner@example.kz "Имя Фамилия"
 * Пароль генерируется и выводится один раз — смените его после входа.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { db } from "@/server/db";
import { hashPassword } from "@/server/auth/password";

async function main() {
  const [email, name = "Владелец"] = process.argv.slice(2);
  if (!email || !email.includes("@")) {
    console.error('Использование: npm run create-owner -- email@example.kz "Имя"');
    process.exit(1);
  }
  const password = randomBytes(9).toString("base64url") + "7a";
  const passwordHash = await hashPassword(password);
  const existing = await db.staffUser.findUnique({ where: { email } });
  if (existing) {
    await db.staffUser.update({ where: { email }, data: { passwordHash, role: "OWNER", isActive: true } });
    await db.staffSession.deleteMany({ where: { staffUserId: existing.id } });
    console.log(`Пароль владельца ${email} сброшен.`);
  } else {
    await db.staffUser.create({ data: { email, name, role: "OWNER", passwordHash } });
    console.log(`Владелец ${email} создан.`);
  }
  console.log(`Временный пароль: ${password}`);
  console.log("Войдите в /admin и смените пароль в разделе «Настройки → Безопасность».");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
