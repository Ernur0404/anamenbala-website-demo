"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db";
import { run } from "@/server/actions/run";
import { DomainError } from "@/server/errors";
import { audit } from "@/server/audit";
import { rateLimit, resetRateLimit } from "@/server/rate-limit";
import { clientIp } from "@/server/request";
import { decryptSecret } from "@/server/crypto";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { verifyTotp } from "@/server/auth/totp";
import { createStaffSession, destroyStaffSession, getStaffSessionState, markSessionTwoFactorVerified } from "@/server/auth/staff";
import { setAdminLocaleCookie } from "@/server/admin/locale";

let dummyHash: Promise<string> | null = null;

/** Путь после входа — только внутри админки */
function safeNext(next: string | null | undefined): string {
  if (next && next.startsWith("/admin") && !next.startsWith("//") && !next.includes("\\")) return next;
  return "/admin";
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200),
  next: z.string().max(500).optional().nullable(),
});

export async function staffLoginAction(raw: z.input<typeof loginSchema>) {
  return run(async () => {
    const input = loginSchema.parse(raw);
    const ip = (await clientIp()) ?? "unknown";
    const ipOk = await rateLimit(`staff-login:ip:${ip}`, 30, 15 * 60);
    const emailOk = await rateLimit(`staff-login:email:${input.email}`, 8, 15 * 60);
    if (!ipOk || !emailOk) throw new DomainError("RATE_LIMITED");

    const staff = await db.staffUser.findUnique({ where: { email: input.email } });
    if (!staff || !staff.isActive) {
      // одинаковое время ответа, чтобы нельзя было перебрать существующие email
      await verifyPassword(await (dummyHash ??= hashPassword("timing-protection-7")), input.password);
      throw new DomainError("INVALID_CREDENTIALS");
    }
    if (!(await verifyPassword(staff.passwordHash, input.password))) {
      await audit({ staffUserId: staff.id, action: "auth.login_failed", entityType: "staff", entityId: staff.id, summary: "Неудачная попытка входа", ip });
      throw new DomainError("INVALID_CREDENTIALS");
    }

    await resetRateLimit(`staff-login:email:${input.email}`);
    await createStaffSession(staff.id, !staff.totpEnabled);
    await setAdminLocaleCookie(staff.locale);
    if (!staff.totpEnabled) {
      await audit({ staffUserId: staff.id, action: "auth.login", entityType: "staff", entityId: staff.id, summary: "Вход в админ-панель", ip });
    }
    return { next: staff.totpEnabled ? `/admin/login/2fa?next=${encodeURIComponent(safeNext(input.next))}` : safeNext(input.next) };
  });
}

const twoFactorSchema = z.object({ code: z.string().trim().min(6).max(10), next: z.string().max(500).optional().nullable() });

export async function staffTwoFactorAction(raw: z.input<typeof twoFactorSchema>) {
  return run(async () => {
    const input = twoFactorSchema.parse(raw);
    const state = await getStaffSessionState();
    if (!state) throw new DomainError("UNAUTHORIZED");
    if (!(await rateLimit(`staff-2fa:${state.session.id}`, 6, 10 * 60))) throw new DomainError("RATE_LIMITED");

    const staff = await db.staffUser.findUniqueOrThrow({ where: { id: state.user.id }, select: { totpSecret: true, totpEnabled: true } });
    if (staff.totpEnabled && staff.totpSecret) {
      if (!verifyTotp(decryptSecret(staff.totpSecret), input.code)) throw new DomainError("INVALID_CREDENTIALS");
      await markSessionTwoFactorVerified();
    }
    await audit({ staffUserId: state.user.id, action: "auth.login", entityType: "staff", entityId: state.user.id, summary: "Вход в админ-панель (2FA)", ip: await clientIp() });
    return { next: safeNext(input.next) };
  });
}

export async function staffLogoutAction() {
  const state = await getStaffSessionState();
  if (state) await audit({ staffUserId: state.user.id, action: "auth.logout", entityType: "staff", entityId: state.user.id, summary: "Выход из админ-панели", ip: await clientIp() });
  await destroyStaffSession();
  redirect("/admin/login");
}
