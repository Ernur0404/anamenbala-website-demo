/** Сессии сотрудников админки */
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "../db";
import { randomToken, sha256 } from "../crypto";
import { isProduction } from "../env";
import { DomainError } from "../errors";
import { can, type Permission } from "../permissions";
import { clientIp, userAgent } from "../request";
import type { StaffUser } from "@/generated/prisma/client";

export const STAFF_COOKIE = "amb_staff";
const SESSION_DAYS = 7;
const EXTEND_WHEN_LEFT_MS = 3 * 86_400_000;

export type StaffIdentity = Pick<StaffUser, "id" | "email" | "name" | "role" | "locale" | "totpEnabled">;

async function setCookie(token: string, expires: Date) {
  (await cookies()).set(STAFF_COOKIE, token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function createStaffSession(staffUserId: string, twoFactorVerified: boolean) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.staffSession.create({
    data: { id: sha256(token), staffUserId, expiresAt, twoFactorVerified, ip: await clientIp(), userAgent: await userAgent() },
  });
  await db.staffUser.update({ where: { id: staffUserId }, data: { lastLoginAt: new Date() } });
  await setCookie(token, expiresAt);
}

type SessionState = { session: { id: string; expiresAt: Date; twoFactorVerified: boolean }; user: StaffIdentity };

/** Текущая сессия (кэш на время запроса). pending2fa — вход по паролю выполнен, ждём код */
export const getStaffSessionState = cache(async (): Promise<(SessionState & { pending2fa: boolean }) | null> => {
  const token = (await cookies()).get(STAFF_COOKIE)?.value;
  if (!token) return null;
  const session = await db.staffSession.findUnique({
    where: { id: sha256(token) },
    include: { staffUser: { select: { id: true, email: true, name: true, role: true, locale: true, totpEnabled: true, isActive: true } } },
  });
  if (!session || session.expiresAt.getTime() < Date.now() || !session.staffUser.isActive) return null;

  const now = Date.now();
  if (session.expiresAt.getTime() - now < EXTEND_WHEN_LEFT_MS) {
    const expiresAt = new Date(now + SESSION_DAYS * 86_400_000);
    await db.staffSession.update({ where: { id: session.id }, data: { expiresAt, lastSeenAt: new Date() } });
    try {
      await setCookie(token, expiresAt);
    } catch {
      // cookies нельзя менять при рендере страницы — продлится при следующем действии
    }
  } else if (now - session.lastSeenAt.getTime() > 5 * 60_000) {
    await db.staffSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
  }

  const { isActive: _active, ...user } = session.staffUser;
  void _active;
  return {
    session: { id: session.id, expiresAt: session.expiresAt, twoFactorVerified: session.twoFactorVerified },
    user,
    pending2fa: user.totpEnabled && !session.twoFactorVerified,
  };
});

export async function getStaff(): Promise<StaffIdentity | null> {
  const state = await getStaffSessionState();
  return state && !state.pending2fa ? state.user : null;
}

/** Для страниц админки: без входа — на страницу входа, без права — на страницу «нет доступа» */
export async function requireStaff(permission?: Permission): Promise<StaffIdentity> {
  const state = await getStaffSessionState();
  if (!state) redirect("/admin/login");
  if (state.pending2fa) redirect("/admin/login/2fa");
  if (permission && !can(state.user.role, permission)) redirect("/admin/forbidden");
  return state.user;
}

/** Для server actions: ошибки вместо редиректа */
export async function requireStaffAction(permission?: Permission): Promise<StaffIdentity & { ip: string | null }> {
  const state = await getStaffSessionState();
  if (!state || state.pending2fa) throw new DomainError("UNAUTHORIZED", "Требуется вход");
  if (permission && !can(state.user.role, permission)) throw new DomainError("FORBIDDEN", "Недостаточно прав");
  return { ...state.user, ip: await clientIp() };
}

export async function markSessionTwoFactorVerified() {
  const state = await getStaffSessionState();
  if (!state) return;
  await db.staffSession.update({ where: { id: state.session.id }, data: { twoFactorVerified: true } });
}

export async function destroyStaffSession() {
  const store = await cookies();
  const token = store.get(STAFF_COOKIE)?.value;
  if (token) await db.staffSession.deleteMany({ where: { id: sha256(token) } });
  store.delete(STAFF_COOKIE);
}

export async function purgeExpiredStaffSessions() {
  await db.staffSession.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}
