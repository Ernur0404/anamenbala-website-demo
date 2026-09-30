/** Аккаунты покупателей: сессии, регистрация, вход, сброс пароля, подтверждение email */
import { cache } from "react";
import { cookies } from "next/headers";
import { db } from "../db";
import { randomToken, sha256 } from "../crypto";
import { env, isProduction } from "../env";
import { DomainError } from "../errors";
import { rateLimit } from "../rate-limit";
import { clientIp, userAgent } from "../request";
import { hashPassword, passwordProblems, verifyPassword } from "./password";
import { enqueueNotification, kickNotificationQueue } from "../notifications/queue";
import { passwordResetEmail, verifyEmailEmail } from "../notifications/messages";
import { normalizePhone } from "@/lib/phone";

export const USER_COOKIE = "amb_user";
const SESSION_DAYS = 30;

export type CurrentUser = { id: string; email: string; name: string; phone: string | null; emailVerifiedAt: Date | null; locale: string };

async function setCookie(token: string, expires: Date) {
  (await cookies()).set(USER_COOKIE, token, { httpOnly: true, secure: isProduction(), sameSite: "lax", path: "/", expires });
}

export async function createUserSession(userId: string) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.userSession.create({ data: { id: sha256(token), userId, expiresAt, ip: await clientIp(), userAgent: await userAgent() } });
  await setCookie(token, expiresAt);
}

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(USER_COOKIE)?.value;
  if (!token) return null;
  const session = await db.userSession.findUnique({
    where: { id: sha256(token) },
    include: { user: { select: { id: true, email: true, name: true, phone: true, emailVerifiedAt: true, locale: true } } },
  });
  if (!session || session.expiresAt.getTime() < Date.now()) return null;
  if (session.expiresAt.getTime() - Date.now() < 10 * 86_400_000) {
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
    await db.userSession.update({ where: { id: session.id }, data: { expiresAt } });
    try {
      await setCookie(token, expiresAt);
    } catch {
      // при рендере cookie не меняются
    }
  }
  return session.user;
});

export async function destroyUserSession() {
  const store = await cookies();
  const token = store.get(USER_COOKIE)?.value;
  if (token) await db.userSession.deleteMany({ where: { id: sha256(token) } });
  store.delete(USER_COOKIE);
}

function localePrefix(locale: string) {
  return locale === "kk" ? "/kk" : "";
}

async function issueToken(userId: string, type: "VERIFY_EMAIL" | "RESET_PASSWORD", ttlMs: number) {
  const token = randomToken(32);
  await db.userToken.deleteMany({ where: { userId, type, usedAt: null } });
  await db.userToken.create({ data: { id: sha256(token), userId, type, expiresAt: new Date(Date.now() + ttlMs) } });
  return token;
}

async function sendVerification(user: { id: string; email: string; locale: string }) {
  const token = await issueToken(user.id, "VERIFY_EMAIL", 3 * 86_400_000);
  const url = `${env().APP_URL}${localePrefix(user.locale)}/account/verify?token=${token}`;
  await enqueueNotification(db, { channel: "EMAIL", event: "user.verify", payload: verifyEmailEmail(user.email, url, user.locale) });
  await kickNotificationQueue();
}

export async function registerUser(input: { email: string; password: string; name: string; phone?: string | null; locale: string }) {
  const ip = (await clientIp()) ?? "unknown";
  if (!(await rateLimit(`register:${ip}`, 5, 3600))) throw new DomainError("RATE_LIMITED", "Слишком много попыток");
  const email = input.email.trim().toLowerCase();
  const problem = passwordProblems(input.password);
  if (problem) throw new DomainError("VALIDATION", problem, { fieldErrors: { password: problem } });
  const phone = input.phone ? normalizePhone(input.phone) : null;
  if (input.phone && !phone) throw new DomainError("VALIDATION", "Неверный телефон", { fieldErrors: { phone: "invalid" } });

  const exists = await db.user.findUnique({ where: { email } });
  if (exists) throw new DomainError("EMAIL_TAKEN", "Этот email уже зарегистрирован", { fieldErrors: { email: "taken" } });

  const user = await db.user.create({
    data: { email, name: input.name.trim(), phone, passwordHash: await hashPassword(input.password), locale: input.locale },
  });
  await createUserSession(user.id);
  await sendVerification(user);
  return user;
}

let dummyHash: Promise<string> | null = null;

export async function loginUser(input: { email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  const ip = (await clientIp()) ?? "unknown";
  if (!(await rateLimit(`login:user:${ip}:${email}`, 8, 900))) throw new DomainError("RATE_LIMITED", "Слишком много попыток входа");
  const user = await db.user.findUnique({ where: { email } });
  // сравнение хэша выполняется всегда — время ответа не выдаёт наличие аккаунта
  dummyHash ??= hashPassword(randomToken(16));
  const valid = await verifyPassword(user?.passwordHash ?? (await dummyHash), input.password);
  if (!user || !valid) throw new DomainError("INVALID_CREDENTIALS", "Неверный email или пароль");
  await createUserSession(user.id);
  return user;
}

export async function requestPasswordReset(emailInput: string) {
  const email = emailInput.trim().toLowerCase();
  const ip = (await clientIp()) ?? "unknown";
  if (!(await rateLimit(`reset:${ip}`, 5, 3600))) throw new DomainError("RATE_LIMITED", "Слишком много попыток");
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return; // не сообщаем, есть ли такой email
  const token = await issueToken(user.id, "RESET_PASSWORD", 3600_000);
  const url = `${env().APP_URL}${localePrefix(user.locale)}/account/reset?token=${token}`;
  await enqueueNotification(db, { channel: "EMAIL", event: "user.reset", payload: passwordResetEmail(user.email, url, user.locale) });
  await kickNotificationQueue();
}

export async function resetPassword(token: string, password: string) {
  const problem = passwordProblems(password);
  if (problem) throw new DomainError("VALIDATION", problem, { fieldErrors: { password: problem } });
  const record = await db.userToken.findUnique({ where: { id: sha256(token) } });
  if (!record || record.type !== "RESET_PASSWORD" || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    throw new DomainError("VALIDATION", "Ссылка устарела", { fieldErrors: { token: "expired" } });
  }
  await db.$transaction([
    db.user.update({ where: { id: record.userId }, data: { passwordHash: await hashPassword(password) } }),
    db.userToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    db.userSession.deleteMany({ where: { userId: record.userId } }),
  ]);
  await createUserSession(record.userId);
}

/** Подтверждение email: заодно привязываем прошлые гостевые заказы с этим email */
export async function verifyEmail(token: string) {
  const record = await db.userToken.findUnique({ where: { id: sha256(token) }, include: { user: true } });
  if (!record || record.type !== "VERIFY_EMAIL" || record.usedAt || record.expiresAt.getTime() < Date.now()) return false;
  await db.$transaction([
    db.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } }),
    db.userToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    db.order.updateMany({
      where: { userId: null, customerEmail: { equals: record.user.email, mode: "insensitive" } },
      data: { userId: record.userId },
    }),
  ]);
  return true;
}

export async function resendVerification(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || user.emailVerifiedAt) return;
  if (!(await rateLimit(`verify:${userId}`, 3, 3600))) throw new DomainError("RATE_LIMITED", "Слишком много попыток");
  await sendVerification(user);
}

export async function changePassword(userId: string, current: string, next: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(user.passwordHash, current))) throw new DomainError("INVALID_CREDENTIALS", "Неверный текущий пароль", { fieldErrors: { current: "invalid" } });
  const problem = passwordProblems(next);
  if (problem) throw new DomainError("VALIDATION", problem, { fieldErrors: { password: problem } });
  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(next) } });
}
