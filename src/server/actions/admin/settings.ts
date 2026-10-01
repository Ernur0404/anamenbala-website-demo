"use server";

import { z } from "zod";
import { adminAction } from "@/server/admin/action";
import { run } from "@/server/actions/run";
import { requireStaffAction } from "@/server/auth/staff";
import { DomainError } from "@/server/errors";
import { audit } from "@/server/audit";
import { deleteDemoData } from "@/server/demo";
import { applyImport, previewImport } from "@/server/admin/import-export";
import {
  contactsSchema,
  createStaff,
  deleteMethod,
  deliveryMethodSchema,
  discoverChats,
  generalSchema,
  moveMethod,
  notificationsSchema,
  paymentMethodSchema,
  resetStaffPassword,
  saveContacts,
  saveDeliveryMethod,
  saveGeneral,
  saveNotifications,
  savePaymentMethod,
  saveSeo,
  saveStatuses,
  sendTestMessage,
  seoSchema,
  staffCreateSchema,
  staffUpdateSchema,
  statusesSchema,
  updateStaff,
} from "@/server/admin/settings-admin";
import { refresh } from "next/cache";

export const saveGeneralAction = adminAction("settings", generalSchema, async (input, actor) => saveGeneral(input, actor));
export const saveContactsAction = adminAction("settings", contactsSchema, async (input, actor) => saveContacts(input, actor));
export const saveSeoAction = adminAction("settings", seoSchema, async (input, actor) => saveSeo(input, actor));
export const saveStatusesAction = adminAction("settings", statusesSchema, async (input, actor) => saveStatuses(input, actor));

export const saveNotificationsAction = adminAction("settings", notificationsSchema, async (input, actor) => saveNotifications(input, actor));
export const discoverChatsAction = adminAction("settings", z.object({ token: z.string().trim().max(200).optional().nullable() }), async ({ token }) => discoverChats(token), { refresh: false });
export const testTelegramAction = adminAction("settings", z.object({}), async (_input, actor) => sendTestMessage(actor), { refresh: false });

export const saveDeliveryMethodAction = adminAction("settings", deliveryMethodSchema, async (input, actor) => saveDeliveryMethod(input, actor));
export const savePaymentMethodAction = adminAction("settings", paymentMethodSchema, async (input, actor) => savePaymentMethod(input, actor));
export const deleteMethodAction = adminAction("settings", z.object({ kind: z.enum(["delivery", "payment"]), id: z.string().min(1) }), async ({ kind, id }, actor) => deleteMethod(kind, id, actor));
export const moveMethodAction = adminAction("settings", z.object({ kind: z.enum(["delivery", "payment"]), id: z.string().min(1), direction: z.enum(["up", "down"]) }), async ({ kind, id, direction }) =>
  moveMethod(kind, id, direction),
);

export const createStaffAction = adminAction("staff", staffCreateSchema, async (input, actor) => createStaff(input, actor));
export const updateStaffAction = adminAction("staff", staffUpdateSchema, async (input, actor) => updateStaff(input, actor));
export const resetStaffPasswordAction = adminAction("staff", z.object({ id: z.string().min(1) }), async ({ id }, actor) => resetStaffPassword(id, actor));

export const deleteDemoAction = adminAction("demo", z.object({ confirm: z.literal(true) }), async (_input, actor) => {
  await deleteDemoData();
  await audit({ staffUserId: actor.id, action: "demo.delete", entityType: "setting", summary: "Удалены демо-данные", ip: actor.ip });
});

async function fileFrom(form: FormData): Promise<Buffer> {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) throw new DomainError("VALIDATION", "Выберите файл .xlsx");
  if (file.size > 20 * 1024 * 1024) throw new DomainError("VALIDATION", "Файл больше 20 МБ");
  return Buffer.from(await file.arrayBuffer());
}

/** Импорт товаров: шаг 1 — проверка файла */
export async function previewImportAction(form: FormData) {
  return run(async () => {
    await requireStaffAction("import");
    return previewImport(await fileFrom(form));
  });
}

/** Импорт товаров: шаг 2 — применение */
export async function applyImportAction(form: FormData) {
  return run(async () => {
    const staff = await requireStaffAction("import");
    const result = await applyImport(await fileFrom(form), staff);
    refresh();
    return result;
  });
}
