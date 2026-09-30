"use server";

import { z } from "zod";
import QRCode from "qrcode";
import { db } from "@/server/db";
import { adminAction } from "@/server/admin/action";
import { setAdminLocaleCookie } from "@/server/admin/locale";
import { DomainError } from "@/server/errors";
import { audit } from "@/server/audit";
import { decryptSecret, encryptSecret } from "@/server/crypto";
import { hashPassword, passwordProblems, verifyPassword } from "@/server/auth/password";
import { generateTotpSecret, otpauthUrl, verifyTotp } from "@/server/auth/totp";
import { getStaffSessionState, markSessionTwoFactorVerified } from "@/server/auth/staff";

export const setStaffLocaleAction = adminAction(null, z.object({ locale: z.enum(["ru", "kk"]) }), async ({ locale }, actor) => {
  await db.staffUser.update({ where: { id: actor.id }, data: { locale } });
  await setAdminLocaleCookie(locale);
});

export const updateStaffProfileAction = adminAction(null, z.object({ name: z.string().trim().min(2).max(120) }), async ({ name }, actor) => {
  await db.staffUser.update({ where: { id: actor.id }, data: { name } });
  await audit({ staffUserId: actor.id, action: "profile.update", entityType: "staff", entityId: actor.id, summary: "Изменены данные профиля", ip: actor.ip });
});

export const changeStaffPasswordAction = adminAction(
  null,
  z.object({ current: z.string().min(1).max(200), next: z.string().min(1).max(200) }),
  async ({ current, next }, actor) => {
    const staff = await db.staffUser.findUniqueOrThrow({ where: { id: actor.id } });
    if (!(await verifyPassword(staff.passwordHash, current))) {
      throw new DomainError("VALIDATION", "Неверный текущий пароль", { fieldErrors: { current: "wrongPassword" } });
    }
    const problem = passwordProblems(next);
    if (problem) throw new DomainError("VALIDATION", problem, { fieldErrors: { next: problem } });
    await db.staffUser.update({ where: { id: actor.id }, data: { passwordHash: await hashPassword(next) } });
    const state = await getStaffSessionState();
    // остальные устройства выходят из админки
    await db.staffSession.deleteMany({ where: { staffUserId: actor.id, id: { not: state?.session.id } } });
    await audit({ staffUserId: actor.id, action: "profile.password", entityType: "staff", entityId: actor.id, summary: "Изменён пароль", ip: actor.ip });
  },
);

/** Шаг 1 включения 2FA: новый секрет (ещё не активен) + QR-код */
export const startTwoFactorAction = adminAction(
  null,
  z.object({}),
  async (_input, actor) => {
    const secret = generateTotpSecret();
    await db.staffUser.update({ where: { id: actor.id }, data: { totpSecret: encryptSecret(secret), totpEnabled: false } });
    const url = otpauthUrl(secret, actor.email);
    const qr = await QRCode.toDataURL(url, { margin: 1, width: 220, color: { dark: "#2f3430", light: "#ffffff" } });
    return { secret, qr };
  },
  { refresh: false },
);

/** Шаг 2: проверка кода и включение */
export const confirmTwoFactorAction = adminAction(null, z.object({ code: z.string().trim().min(6).max(10) }), async ({ code }, actor) => {
  const staff = await db.staffUser.findUniqueOrThrow({ where: { id: actor.id } });
  if (!staff.totpSecret || !verifyTotp(decryptSecret(staff.totpSecret), code)) {
    throw new DomainError("VALIDATION", "Неверный код", { fieldErrors: { code: "invalid" } });
  }
  await db.staffUser.update({ where: { id: actor.id }, data: { totpEnabled: true } });
  await markSessionTwoFactorVerified();
  await audit({ staffUserId: actor.id, action: "profile.2fa_on", entityType: "staff", entityId: actor.id, summary: "Включена двухфакторная аутентификация", ip: actor.ip });
});

export const disableTwoFactorAction = adminAction(null, z.object({ code: z.string().trim().min(6).max(10) }), async ({ code }, actor) => {
  const staff = await db.staffUser.findUniqueOrThrow({ where: { id: actor.id } });
  if (staff.totpEnabled && (!staff.totpSecret || !verifyTotp(decryptSecret(staff.totpSecret), code))) {
    throw new DomainError("VALIDATION", "Неверный код", { fieldErrors: { code: "invalid" } });
  }
  await db.staffUser.update({ where: { id: actor.id }, data: { totpEnabled: false, totpSecret: null } });
  await audit({ staffUserId: actor.id, action: "profile.2fa_off", entityType: "staff", entityId: actor.id, summary: "Отключена двухфакторная аутентификация", ip: actor.ip });
});

export const endStaffSessionAction = adminAction(null, z.object({ id: z.string().min(10).max(100).optional() }), async ({ id }, actor) => {
  const state = await getStaffSessionState();
  if (id) {
    if (id === state?.session.id) throw new DomainError("VALIDATION", "Нельзя завершить текущий сеанс");
    await db.staffSession.deleteMany({ where: { id, staffUserId: actor.id } });
  } else {
    await db.staffSession.deleteMany({ where: { staffUserId: actor.id, id: { not: state?.session.id } } });
  }
});
