/** Настройки магазина в админке (только владелец) */
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { db, transaction } from "../db";
import { DomainError } from "../errors";
import { audit } from "../audit";
import { CacheTags, invalidateTags } from "../cache";
import { getSetting, settingsSchemas, updateSetting } from "../settings";
import { decryptSecret, encryptSecret } from "../crypto";
import { hashPassword } from "../auth/password";
import { discoverTelegramChats, sendTelegramMessage } from "../notifications/telegram";
import { env } from "../env";
import type { AdminActor } from "./action";

const L = z.object({ ru: z.string().trim().max(2000).default(""), kk: z.string().trim().max(2000).default("") });
const who = (actor: AdminActor) => ({ staffUserId: actor.id, ip: actor.ip });

// ───────────── общие, контакты, SEO, статусы ─────────────

export const generalSchema = z.object({
  storeName: z.string().trim().min(1).max(80),
  tagline: L,
  shortDescription: L,
  logoMediaId: z.string().nullable(),
  faviconMediaId: z.string().nullable(),
  lowStockThreshold: z.number().int().min(0).max(1000),
  newArrivalDays: z.number().int().min(1).max(365),
});

export async function saveGeneral(raw: z.input<typeof generalSchema>, actor: AdminActor) {
  const input = generalSchema.parse(raw);
  const current = await getSetting("general");
  await updateSetting("general", { ...current, ...input }, who(actor));
  invalidateTags(CacheTags.content);
}

export const contactsSchema = settingsSchemas.contacts;

export async function saveContacts(raw: z.input<typeof contactsSchema>, actor: AdminActor) {
  await updateSetting("contacts", contactsSchema.parse(raw), who(actor));
  invalidateTags(CacheTags.content);
}

export const seoSchema = settingsSchemas.seo;
export async function saveSeo(raw: z.input<typeof seoSchema>, actor: AdminActor) {
  await updateSetting("seo", seoSchema.parse(raw), who(actor));
}

export const statusesSchema = settingsSchemas.statuses;
export async function saveStatuses(raw: z.input<typeof statusesSchema>, actor: AdminActor) {
  await updateSetting("statuses", statusesSchema.parse(raw), who(actor));
}

// ───────────── уведомления ─────────────

export const notificationsSchema = z.object({
  /** Новый токен; пусто — оставить сохранённый */
  newToken: z.string().trim().max(200).optional().nullable(),
  clearToken: z.boolean().default(false),
  telegramChatIds: z.array(z.string().trim().regex(/^-?\d{3,20}$/)).max(10),
  events: z.object({ newOrder: z.boolean(), newReview: z.boolean(), lowStock: z.boolean(), contactMessage: z.boolean() }),
  customerEmails: z.object({ orderCreated: z.boolean(), statusChanged: z.boolean() }),
  adminEmails: z.array(z.string().trim().email()).max(5),
});

export async function saveNotifications(raw: z.input<typeof notificationsSchema>, actor: AdminActor) {
  const input = notificationsSchema.parse(raw);
  const current = await getSetting("notifications");
  let telegramBotToken = current.telegramBotToken;
  if (input.clearToken) telegramBotToken = "";
  else if (input.newToken) {
    if (!/^\d{5,15}:[A-Za-z0-9_-]{20,}$/.test(input.newToken)) throw new DomainError("VALIDATION", "Неверный формат токена", { fieldErrors: { newToken: "invalid" } });
    telegramBotToken = encryptSecret(input.newToken);
  }
  await updateSetting(
    "notifications",
    { telegramBotToken, telegramChatIds: [...new Set(input.telegramChatIds)], events: input.events, customerEmails: input.customerEmails, adminEmails: input.adminEmails },
    who(actor),
  );
}

async function currentToken(provided?: string | null): Promise<string> {
  if (provided) return provided;
  const settings = await getSetting("notifications");
  if (!settings.telegramBotToken) throw new DomainError("VALIDATION", "Сначала сохраните токен бота", { fieldErrors: { newToken: "required" } });
  return decryptSecret(settings.telegramBotToken);
}

export async function discoverChats(token: string | null | undefined) {
  try {
    return await discoverTelegramChats(await currentToken(token));
  } catch (error) {
    if (error instanceof DomainError) throw error;
    throw new DomainError("VALIDATION", (error as Error).message, { reason: "token", fieldErrors: { newToken: "invalid" } });
  }
}

export async function sendTestMessage(actor: AdminActor) {
  const settings = await getSetting("notifications");
  if (!settings.telegramChatIds.length) throw new DomainError("VALIDATION", "Нет чатов", { reason: "noChats" });
  const token = await currentToken(null);
  const store = (await getSetting("general")).storeName;
  const errors: string[] = [];
  for (const chatId of settings.telegramChatIds) {
    try {
      await sendTelegramMessage(token, chatId, `✅ <b>${store}</b>: уведомления подключены.\nПроверку отправил(а): ${actor.name}`);
    } catch (error) {
      errors.push(`${chatId}: ${(error as Error).message}`);
    }
  }
  if (errors.length) throw new DomainError("VALIDATION", errors.join("; "), { reason: "telegram" });
}

export function smtpConfigured() {
  return Boolean(env().SMTP_URL);
}

// ───────────── доставка и оплата ─────────────

const text = (max: number) => z.string().trim().max(max).optional().nullable();
const blank = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

export const deliveryMethodSchema = z.object({
  id: z.string().optional().nullable(),
  kind: z.enum(["KAZAKHSTAN", "LOCAL_COURIER", "PICKUP"]),
  nameRu: z.string().trim().min(1).max(100),
  nameKk: text(100),
  descriptionRu: text(500),
  descriptionKk: text(500),
  etaRu: text(80),
  etaKk: text(80),
  price: z.number().int().min(0).max(10_000_000),
  freeFrom: z.number().int().min(0).max(100_000_000).nullable().optional(),
  addressRu: text(300),
  addressKk: text(300),
  icon: text(40),
  isActive: z.boolean(),
});

export async function saveDeliveryMethod(raw: z.input<typeof deliveryMethodSchema>, actor: AdminActor) {
  const input = deliveryMethodSchema.parse(raw);
  const data = {
    kind: input.kind,
    nameRu: input.nameRu,
    nameKk: blank(input.nameKk),
    descriptionRu: blank(input.descriptionRu),
    descriptionKk: blank(input.descriptionKk),
    etaRu: blank(input.etaRu),
    etaKk: blank(input.etaKk),
    price: input.price,
    freeFrom: input.freeFrom ?? null,
    addressRu: blank(input.addressRu),
    addressKk: blank(input.addressKk),
    icon: blank(input.icon),
    isActive: input.isActive,
  };
  let id = input.id;
  if (id) await db.deliveryMethod.update({ where: { id }, data });
  else {
    const last = await db.deliveryMethod.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
    const created = await db.deliveryMethod.create({ data: { ...data, sortOrder: (last?.sortOrder ?? -1) + 1 } });
    id = created.id;
    // новый способ доставки сразу доступен со всеми включёнными способами оплаты
    const payments = await db.paymentMethod.findMany({ where: { isActive: true }, select: { id: true } });
    await db.deliveryPayment.createMany({ data: payments.map((p) => ({ deliveryMethodId: id!, paymentMethodId: p.id })), skipDuplicates: true });
  }
  await audit({ ...who(actor), action: "delivery.save", entityType: "setting", entityId: id, summary: `Способ доставки «${input.nameRu}»` });
  invalidateTags(CacheTags.delivery);
  return { id };
}

export const paymentMethodSchema = z.object({
  id: z.string().optional().nullable(),
  kind: z.enum(["KASPI", "ON_DELIVERY", "ONLINE"]),
  nameRu: z.string().trim().min(1).max(100),
  nameKk: text(100),
  descriptionRu: text(500),
  descriptionKk: text(500),
  instructionsRu: text(2000),
  instructionsKk: text(2000),
  icon: text(40),
  isActive: z.boolean(),
  deliveryMethodIds: z.array(z.string()).max(20),
});

export async function savePaymentMethod(raw: z.input<typeof paymentMethodSchema>, actor: AdminActor) {
  const input = paymentMethodSchema.parse(raw);
  const data = {
    kind: input.kind,
    nameRu: input.nameRu,
    nameKk: blank(input.nameKk),
    descriptionRu: blank(input.descriptionRu),
    descriptionKk: blank(input.descriptionKk),
    instructionsRu: blank(input.instructionsRu),
    instructionsKk: blank(input.instructionsKk),
    icon: blank(input.icon),
    isActive: input.isActive,
  };
  const id = await transaction(async (tx) => {
    let methodId = input.id;
    if (methodId) await tx.paymentMethod.update({ where: { id: methodId }, data });
    else {
      const last = await tx.paymentMethod.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
      methodId = (await tx.paymentMethod.create({ data: { ...data, sortOrder: (last?.sortOrder ?? -1) + 1 } })).id;
    }
    await tx.deliveryPayment.deleteMany({ where: { paymentMethodId: methodId } });
    await tx.deliveryPayment.createMany({ data: input.deliveryMethodIds.map((deliveryMethodId) => ({ deliveryMethodId, paymentMethodId: methodId! })), skipDuplicates: true });
    return methodId;
  });
  await audit({ ...who(actor), action: "payment.save", entityType: "setting", entityId: id, summary: `Способ оплаты «${input.nameRu}»` });
  invalidateTags(CacheTags.delivery);
  return { id };
}

/** Способ, который уже был в заказах, не удаляется, а выключается */
export async function deleteMethod(kind: "delivery" | "payment", id: string, actor: AdminActor) {
  const used = kind === "delivery" ? await db.order.count({ where: { deliveryMethodId: id } }) : await db.order.count({ where: { paymentMethodId: id } });
  if (used > 0) {
    if (kind === "delivery") await db.deliveryMethod.update({ where: { id }, data: { isActive: false } });
    else await db.paymentMethod.update({ where: { id }, data: { isActive: false } });
  } else if (kind === "delivery") await db.deliveryMethod.delete({ where: { id } });
  else await db.paymentMethod.delete({ where: { id } });
  await audit({ ...who(actor), action: `${kind}.delete`, entityType: "setting", entityId: id, summary: used ? "Способ выключен (есть в заказах)" : "Способ удалён" });
  invalidateTags(CacheTags.delivery);
  return { disabled: used > 0 };
}

export async function moveMethod(kind: "delivery" | "payment", id: string, direction: "up" | "down") {
  const rows = kind === "delivery" ? await db.deliveryMethod.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true } }) : await db.paymentMethod.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true } });
  const index = rows.findIndex((r) => r.id === id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= rows.length) return;
  [rows[index], rows[target]] = [rows[target], rows[index]];
  await transaction(async (tx) => {
    for (const [i, r] of rows.entries()) {
      if (kind === "delivery") await tx.deliveryMethod.update({ where: { id: r.id }, data: { sortOrder: i } });
      else await tx.paymentMethod.update({ where: { id: r.id }, data: { sortOrder: i } });
    }
  });
  invalidateTags(CacheTags.delivery);
}

// ───────────── сотрудники ─────────────

const ROLE_RU = { OWNER: "владелец", MANAGER: "менеджер" } as const;

function tempPassword() {
  // 12 символов без похожих (0/O, l/1) + гарантированно буквы и цифры
  const alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(12);
  const body = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return `${body.slice(0, 10)}${"23456789"[bytes[10] % 8]}${"abcdefghijkmnpqrstuvwxyz"[bytes[11] % 24]}`;
}

export const staffCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  role: z.enum(["OWNER", "MANAGER"]),
  locale: z.enum(["ru", "kk"]),
});

export async function createStaff(raw: z.input<typeof staffCreateSchema>, actor: AdminActor) {
  const input = staffCreateSchema.parse(raw);
  if (await db.staffUser.findUnique({ where: { email: input.email }, select: { id: true } })) {
    throw new DomainError("EMAIL_TAKEN", "Email занят", { fieldErrors: { email: "EMAIL_TAKEN" } });
  }
  const password = tempPassword();
  const staff = await db.staffUser.create({ data: { ...input, passwordHash: await hashPassword(password) } });
  await audit({ ...who(actor), action: "staff.create", entityType: "staff", entityId: staff.id, summary: `Добавлен сотрудник ${staff.name} (${ROLE_RU[staff.role]})` });
  return { id: staff.id, password };
}

export const staffUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2).max(120),
  role: z.enum(["OWNER", "MANAGER"]),
  locale: z.enum(["ru", "kk"]),
  isActive: z.boolean(),
});

async function assertOwnersRemain(excludeId: string) {
  const owners = await db.staffUser.count({ where: { role: "OWNER", isActive: true, id: { not: excludeId } } });
  if (owners === 0) throw new DomainError("VALIDATION", "Должен остаться владелец", { reason: "lastOwner" });
}

export async function updateStaff(raw: z.input<typeof staffUpdateSchema>, actor: AdminActor) {
  const input = staffUpdateSchema.parse(raw);
  const existing = await db.staffUser.findUnique({ where: { id: input.id } });
  if (!existing) throw new DomainError("NOT_FOUND");
  if (input.id === actor.id && (!input.isActive || input.role !== "OWNER")) throw new DomainError("VALIDATION", "Нельзя себя", { reason: "cannotSelf" });
  if (existing.role === "OWNER" && (input.role !== "OWNER" || !input.isActive)) await assertOwnersRemain(input.id);
  await db.staffUser.update({ where: { id: input.id }, data: { name: input.name, role: input.role, locale: input.locale, isActive: input.isActive } });
  if (!input.isActive || input.role !== existing.role) await db.staffSession.deleteMany({ where: { staffUserId: input.id } });
  await audit({ ...who(actor), action: "staff.update", entityType: "staff", entityId: input.id, summary: `Изменён сотрудник ${input.name}: ${ROLE_RU[input.role]}, ${input.isActive ? "активен" : "отключён"}` });
}

export async function resetStaffPassword(id: string, actor: AdminActor) {
  const staff = await db.staffUser.findUnique({ where: { id } });
  if (!staff) throw new DomainError("NOT_FOUND");
  const password = tempPassword();
  await db.staffUser.update({ where: { id }, data: { passwordHash: await hashPassword(password) } });
  await db.staffSession.deleteMany({ where: { staffUserId: id } });
  await audit({ ...who(actor), action: "staff.reset_password", entityType: "staff", entityId: id, summary: `Сброшен пароль сотрудника ${staff.name}` });
  return { password };
}
