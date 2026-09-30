/** Заказы, созданные сотрудниками: ручной заказ (WhatsApp / Instagram / телефон) и продажа в магазине (касса) */
import { z } from "zod";
import { transaction } from "../db";
import { DomainError } from "../errors";
import { audit } from "../audit";
import { normalizePhone } from "@/lib/phone";
import { formatMoney } from "@/lib/money";
import { buildQuote, normalizePromoCode, type Quote } from "./quote";
import { createOrderRecord } from "./create";
import { afterStockChange } from "../stock-effects";

export const staffOrderItemSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().min(1).max(999),
  unitPrice: z.number().int().min(0).nullable().optional(),
});

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();

export const manualOrderSchema = z.object({
  source: optionalText(40),
  customerName: z.string().trim().min(1).max(100),
  customerPhone: z.string().trim().min(10).max(30),
  customerEmail: z.union([z.string().trim().email().max(200), z.literal("")]).optional().nullable(),
  items: z.array(staffOrderItemSchema).min(1).max(100),
  deliveryMethodId: z.string().optional().nullable(),
  deliveryPrice: z.number().int().min(0).optional().nullable(),
  region: optionalText(120),
  city: optionalText(120),
  street: optionalText(200),
  house: optionalText(40),
  apartment: optionalText(40),
  postalCode: optionalText(20),
  paymentMethodId: z.string().optional().nullable(),
  promoCode: optionalText(40),
  comment: optionalText(1000),
  managerNote: optionalText(2000),
  status: z.enum(["NEW", "CONFIRMED"]).default("NEW"),
  paymentStatus: z.enum(["UNPAID", "PAID"]).default("UNPAID"),
});

export type ManualOrderInput = z.infer<typeof manualOrderSchema>;

export type StaffActor = { staffUserId: string; role: "OWNER" | "MANAGER"; ip?: string | null };

function assertQuote(quote: Quote, promoRequested: boolean) {
  if (quote.problems.length) {
    const first = quote.problems[0];
    throw new DomainError(first.code, first.code === "OUT_OF_STOCK" ? "Недостаточно товара на складе" : "Товар недоступен", { problems: quote.problems });
  }
  if (promoRequested && quote.promoError) throw new DomainError(quote.promoError.code, "Промокод не применён", { ...quote.promoError });
}

export async function createManualOrder(raw: ManualOrderInput, actor: StaffActor) {
  const input = manualOrderSchema.parse(raw);
  const phone = normalizePhone(input.customerPhone);
  if (!phone) throw new DomainError("VALIDATION", "Неверный номер телефона", { fieldErrors: { customerPhone: "invalid" } });

  const result = await transaction(async (tx) => {
    const delivery = input.deliveryMethodId ? await tx.deliveryMethod.findUnique({ where: { id: input.deliveryMethodId } }) : null;
    const payment = input.paymentMethodId ? await tx.paymentMethod.findUnique({ where: { id: input.paymentMethodId } }) : null;
    const quote = await buildQuote(
      tx,
      {
        items: input.items,
        deliveryMethodId: delivery?.id ?? null,
        deliveryPriceOverride: input.deliveryPrice ?? null,
        promoCode: input.promoCode,
        customerPhone: phone,
      },
      { allowUnpublished: true, allowInactiveDelivery: true },
    );
    assertQuote(quote, Boolean(normalizePromoCode(input.promoCode)));

    const created = await createOrderRecord(tx, quote, {
      channel: "MANUAL",
      source: input.source,
      status: input.status,
      paymentStatus: input.paymentStatus,
      customer: { name: input.customerName, phone, email: input.customerEmail || null },
      delivery: {
        method: delivery,
        region: input.region,
        city: input.city || (delivery?.kind === "LOCAL_COURIER" ? delivery.addressRu : null),
        street: input.street,
        house: input.house,
        apartment: input.apartment,
        postalCode: input.postalCode,
      },
      payment: { method: payment },
      comment: input.comment,
      managerNote: input.managerNote,
      createdById: actor.staffUserId,
      backorder: "product",
      actor: { staffUserId: actor.staffUserId },
    });

    await audit(
      {
        staffUserId: actor.staffUserId,
        action: "order.create",
        entityType: "order",
        entityId: created.orderId,
        summary: `Создан заказ №${created.number} вручную (${input.source ?? "без источника"}) на ${formatMoney(quote.totals.total)}`,
        ip: actor.ip,
      },
      tx,
    );
    return { ...created, productIds: quote.lines.map((l) => l.productId) };
  });

  await afterStockChange(result.productIds, result.stockChanges.values());
  return { orderId: result.orderId, number: result.number };
}

export const POS_PAYMENT_LABELS = { CASH: "Наличные", CARD: "Карта", KASPI: "Kaspi QR" } as const;

export const posSaleSchema = z.object({
  items: z.array(staffOrderItemSchema).min(1).max(100),
  payment: z.enum(["CASH", "CARD", "KASPI"]),
  customerName: optionalText(100),
  customerPhone: optionalText(30),
  note: optionalText(500),
});

export type PosSaleInput = z.infer<typeof posSaleSchema>;

/** Продажа в магазине: заказ сразу «Завершён» и «Оплачен», товар списывается строго по остатку */
export async function createPosSale(raw: PosSaleInput, actor: StaffActor) {
  const input = posSaleSchema.parse(raw);
  const phone = input.customerPhone ? normalizePhone(input.customerPhone) : null;
  if (input.customerPhone && !phone) throw new DomainError("VALIDATION", "Неверный номер телефона", { fieldErrors: { customerPhone: "invalid" } });

  const result = await transaction(async (tx) => {
    const quote = await buildQuote(tx, { items: input.items }, { allowUnpublished: true });
    const shortage = quote.lines.find((l) => l.stock < l.quantity);
    if (shortage) {
      throw new DomainError("OUT_OF_STOCK", "Недостаточно товара на складе", {
        problems: [{ variantId: shortage.variantId, code: "OUT_OF_STOCK", available: Math.max(0, shortage.stock) }],
      });
    }
    assertQuote(quote, false);

    const created = await createOrderRecord(tx, quote, {
      channel: "POS",
      source: "Магазин",
      status: "COMPLETED",
      paymentStatus: "PAID",
      customer: { name: input.customerName?.trim() || "Покупатель в магазине", phone },
      payment: { method: null, label: POS_PAYMENT_LABELS[input.payment] },
      managerNote: input.note,
      createdById: actor.staffUserId,
      backorder: "never",
      actor: { staffUserId: actor.staffUserId },
    });
    await audit(
      {
        staffUserId: actor.staffUserId,
        action: "pos.sale",
        entityType: "order",
        entityId: created.orderId,
        summary: `Продажа в магазине №${created.number} на ${formatMoney(quote.totals.total)} (${POS_PAYMENT_LABELS[input.payment]})`,
        ip: actor.ip,
      },
      tx,
    );
    return { ...created, total: quote.totals.total, productIds: quote.lines.map((l) => l.productId) };
  });

  await afterStockChange(result.productIds, result.stockChanges.values());
  return { orderId: result.orderId, number: result.number, total: result.total };
}
