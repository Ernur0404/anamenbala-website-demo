"use server";

import { z } from "zod";
import { getLocale } from "next-intl/server";
import { db } from "../db";
import { DomainError, type ActionResult } from "../errors";
import { run } from "./run";
import {
  changePassword,
  destroyUserSession,
  getCurrentUser,
  loginUser,
  registerUser,
  requestPasswordReset,
  resendVerification,
  resetPassword,
} from "../auth/customer";
import { mergeGuestIntoUser } from "../store-session";
import { normalizePhone } from "@/lib/phone";

/** Разрешаем переход только на внутренние страницы */
function safeNext(next: string | null | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/account";
}

export async function loginAction(input: { email: string; password: string; next?: string | null }): Promise<ActionResult<{ redirect: string }>> {
  return run(async () => {
    const data = z.object({ email: z.string().trim().email(), password: z.string().min(1).max(200) }).parse(input);
    const user = await loginUser(data);
    await mergeGuestIntoUser(user.id);
    return { redirect: safeNext(input.next) };
  });
}

export async function registerAction(input: { name: string; email: string; password: string; phone?: string; next?: string | null }): Promise<ActionResult<{ redirect: string }>> {
  return run(async () => {
    const data = z
      .object({
        name: z.string().trim().min(2).max(100),
        email: z.string().trim().email().max(200),
        password: z.string().min(1).max(200),
        phone: z.string().trim().max(30).optional(),
      })
      .parse(input);
    const locale = (await getLocale()) === "kk" ? "kk" : "ru";
    const user = await registerUser({ ...data, phone: data.phone || null, locale });
    await mergeGuestIntoUser(user.id);
    return { redirect: safeNext(input.next) };
  });
}

export async function logoutAction(): Promise<ActionResult<undefined>> {
  return run(async () => {
    await destroyUserSession();
    return undefined;
  });
}

export async function forgotPasswordAction(email: string): Promise<ActionResult<undefined>> {
  return run(async () => {
    await requestPasswordReset(z.string().trim().email().parse(email));
    return undefined;
  });
}

export async function resetPasswordAction(input: { token: string; password: string }): Promise<ActionResult<undefined>> {
  return run(async () => {
    await resetPassword(z.string().min(10).parse(input.token), input.password);
    return undefined;
  });
}

export async function resendVerificationAction(): Promise<ActionResult<undefined>> {
  return run(async () => {
    const user = await getCurrentUser();
    if (!user) throw new DomainError("UNAUTHORIZED", "Войдите в аккаунт");
    await resendVerification(user.id);
    return undefined;
  });
}

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new DomainError("UNAUTHORIZED", "Войдите в аккаунт");
  return user;
}

export async function updateProfileAction(input: { name: string; phone: string }): Promise<ActionResult<undefined>> {
  return run(async () => {
    const user = await requireUser();
    const data = z.object({ name: z.string().trim().min(2).max(100), phone: z.string().trim().max(30) }).parse(input);
    const phone = data.phone ? normalizePhone(data.phone) : null;
    if (data.phone && !phone) throw new DomainError("VALIDATION", "Неверный телефон", { fieldErrors: { phone: "invalidPhone" } });
    await db.user.update({ where: { id: user.id }, data: { name: data.name, phone } });
    return undefined;
  });
}

export async function changePasswordAction(input: { current: string; next: string }): Promise<ActionResult<undefined>> {
  return run(async () => {
    const user = await requireUser();
    await changePassword(user.id, input.current, input.next);
    return undefined;
  });
}

const addressSchema = z.object({
  id: z.string().optional().nullable(),
  label: z.string().trim().max(60).optional().nullable(),
  region: z.string().trim().max(120).optional().nullable(),
  city: z.string().trim().min(1).max(120),
  street: z.string().trim().min(1).max(200),
  house: z.string().trim().min(1).max(40),
  apartment: z.string().trim().max(40).optional().nullable(),
  postalCode: z.string().trim().max(20).optional().nullable(),
  isDefault: z.boolean().optional(),
});

export async function saveAddressAction(input: z.infer<typeof addressSchema>): Promise<ActionResult<undefined>> {
  return run(async () => {
    const user = await requireUser();
    const { id, isDefault, ...data } = addressSchema.parse(input);
    const count = await db.address.count({ where: { userId: user.id } });
    if (!id && count >= 10) throw new DomainError("VALIDATION", "Можно сохранить до 10 адресов");
    const makeDefault = isDefault || count === 0;
    if (makeDefault) await db.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
    if (id) {
      const updated = await db.address.updateMany({ where: { id, userId: user.id }, data: { ...data, ...(makeDefault ? { isDefault: true } : {}) } });
      if (!updated.count) throw new DomainError("NOT_FOUND", "Адрес не найден");
    } else {
      await db.address.create({ data: { ...data, userId: user.id, isDefault: makeDefault } });
    }
    return undefined;
  });
}

export async function deleteAddressAction(id: string): Promise<ActionResult<undefined>> {
  return run(async () => {
    const user = await requireUser();
    await db.address.deleteMany({ where: { id, userId: user.id } });
    return undefined;
  });
}

export async function setDefaultAddressAction(id: string): Promise<ActionResult<undefined>> {
  return run(async () => {
    const user = await requireUser();
    await db.$transaction([
      db.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } }),
      db.address.updateMany({ where: { id, userId: user.id }, data: { isDefault: true } }),
    ]);
    return undefined;
  });
}
