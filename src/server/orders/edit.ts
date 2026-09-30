/** Редактирование заказа сотрудником: состав (с корректировкой остатков) и данные доставки/контакты */
import { z } from "zod";
import { transaction } from "../db";
import { DomainError } from "../errors";
import { audit } from "../audit";
import { normalizePhone } from "@/lib/phone";
import { formatMoney } from "@/lib/money";
import { upsertCustomer } from "../customers";
import { rebalanceStock, type StockChange } from "../stock";
import { adjustSalesCount, lockOrder } from "./helpers";
import { buildQuote } from "./quote";
import { staffOrderItemSchema, type StaffActor } from "./staff";
import { afterStockChange } from "../stock-effects";

/** Состав можно менять до отправки */
export const EDITABLE_STATUSES = ["NEW", "CONFIRMED", "PACKING"] as const;

export const orderItemsEditSchema = z.object({
  items: z.array(staffOrderItemSchema).min(1).max(100),
  comment: z.string().trim().max(500).optional().nullable(),
});

export async function updateOrderItems(orderId: string, raw: z.infer<typeof orderItemsEditSchema>, actor: StaffActor) {
  const input = orderItemsEditSchema.parse(raw);
  let changes: StockChange[] = [];
  let productIds: string[] = [];

  const result = await transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (!order) throw new DomainError("NOT_FOUND", "Заказ не найден");
    if (!(EDITABLE_STATUSES as readonly string[]).includes(order.status)) {
      throw new DomainError("ORDER_LOCKED", "Состав можно менять только до отправки заказа");
    }

    const quote = await buildQuote(
      tx,
      {
        items: input.items,
        deliveryMethodId: order.deliveryMethodId,
        deliveryPriceOverride: order.deliveryPrice,
        promoCode: order.promoCodeText,
        customerPhone: order.customerPhone || null,
      },
      { allowUnpublished: true, ignorePromoLimits: true, excludeOrderId: order.id, allowInactiveDelivery: true },
    );
    const unavailable = quote.problems.find((p) => p.code === "VARIANT_UNAVAILABLE");
    if (unavailable) throw new DomainError("VARIANT_UNAVAILABLE", "Товар недоступен", { problems: quote.problems });

    // пересчёт списания: сколько было списано под заказ → сколько нужно теперь
    let stockChanges = new Map<string, StockChange>();
    if (order.stockReserved) {
      const oldTaken = new Map<string, number>();
      for (const item of order.items) {
        if (!item.variantId) continue;
        oldTaken.set(item.variantId, (oldTaken.get(item.variantId) ?? 0) + item.quantity - item.backorderQty);
      }
      const newQty = new Map(quote.lines.map((l) => [l.variantId, l.quantity]));
      const variantIds = new Set([...oldTaken.keys(), ...newQty.keys()]);
      stockChanges = await rebalanceStock(
        tx,
        [...variantIds].map((variantId) => ({ variantId, oldTaken: oldTaken.get(variantId) ?? 0, newQuantity: newQty.get(variantId) ?? 0 })),
        { reason: "ORDER_EDITED", orderId: order.id, staffUserId: actor.staffUserId },
        { backorder: order.channel === "POS" ? "never" : "product" },
      );
      await adjustSalesCount(tx, order.items, -1);
      await adjustSalesCount(tx, quote.lines, 1);
    }

    await tx.orderItem.deleteMany({ where: { orderId } });
    await tx.orderItem.createMany({
      data: quote.lines.map((l) => ({
        orderId,
        productId: l.productId,
        variantId: l.variantId,
        nameRu: l.nameRu,
        nameKk: l.nameKk,
        variantLabelRu: l.variantLabelRu,
        variantLabelKk: l.variantLabelKk,
        sku: l.sku,
        imageUrl: l.imageUrl,
        regularPrice: l.regularUnit,
        unitPrice: l.finalUnit,
        costPrice: l.costUnit,
        quantity: l.quantity,
        backorderQty: stockChanges.get(l.variantId)?.backorder ?? 0,
        lineTotal: l.lineTotal,
      })),
    });

    const promoDiscount = quote.promo?.discount ?? 0;
    const total = quote.totals.itemsTotal - promoDiscount + order.deliveryPrice;
    await tx.order.update({
      where: { id: orderId },
      data: {
        itemsRegular: quote.totals.itemsRegular,
        itemsTotal: quote.totals.itemsTotal,
        itemsDiscount: quote.totals.itemsDiscount,
        promoDiscount,
        total,
        costTotal: quote.lines.reduce((s, l) => s + (l.costUnit ?? 0) * l.quantity, 0),
      },
    });
    if (order.promoCodeId) {
      await tx.promoRedemption.updateMany({ where: { orderId }, data: { amount: promoDiscount } });
    }

    const summary = `Состав изменён: ${formatMoney(order.total)} → ${formatMoney(total)}`;
    await tx.orderHistory.create({
      data: { orderId, kind: "EDIT", comment: [summary, input.comment].filter(Boolean).join(". "), staffUserId: actor.staffUserId },
    });
    await audit({ staffUserId: actor.staffUserId, action: "order.items", entityType: "order", entityId: orderId, summary: `Заказ №${order.number}. ${summary}`, ip: actor.ip }, tx);

    changes = [...stockChanges.values()];
    productIds = [...new Set([...order.items.map((i) => i.productId), ...quote.lines.map((l) => l.productId)])].filter((id): id is string => Boolean(id));
    return { total };
  });

  if (changes.length || productIds.length) await afterStockChange(productIds, changes);
  return result;
}

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();

export const orderInfoSchema = z.object({
  customerName: z.string().trim().min(1).max(100).optional(),
  customerPhone: z.string().trim().max(30).optional(),
  customerEmail: z.union([z.string().trim().email().max(200), z.literal("")]).optional().nullable(),
  deliveryMethodId: z.string().optional().nullable(),
  deliveryPrice: z.number().int().min(0).optional(),
  region: optionalText(120),
  city: optionalText(120),
  street: optionalText(200),
  house: optionalText(40),
  apartment: optionalText(40),
  postalCode: optionalText(20),
  paymentMethodId: z.string().optional().nullable(),
  comment: optionalText(1000),
  trackingNumber: optionalText(100),
  managerNote: optionalText(2000),
});

const FIELD_LABELS: Record<string, string> = {
  customerName: "имя",
  customerPhone: "телефон",
  customerEmail: "email",
  deliveryMethodId: "способ доставки",
  deliveryPrice: "стоимость доставки",
  region: "область",
  city: "город",
  street: "улица",
  house: "дом",
  apartment: "квартира",
  postalCode: "индекс",
  paymentMethodId: "способ оплаты",
  comment: "комментарий",
  trackingNumber: "трек-номер",
  managerNote: "заметка менеджера",
};

export async function updateOrderInfo(orderId: string, raw: z.infer<typeof orderInfoSchema>, actor: StaffActor) {
  const input = orderInfoSchema.parse(raw);
  return transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (!order) throw new DomainError("NOT_FOUND", "Заказ не найден");

    const data: Record<string, unknown> = {};
    const changed: string[] = [];
    const setIfChanged = (key: string, value: unknown) => {
      if (value === undefined) return;
      const current = (order as Record<string, unknown>)[key];
      const next = value === "" ? null : value;
      if (current !== next) {
        data[key] = next;
        changed.push(key);
      }
    };

    if (input.customerPhone !== undefined) {
      const phone = normalizePhone(input.customerPhone);
      if (!phone) throw new DomainError("VALIDATION", "Неверный номер телефона", { fieldErrors: { customerPhone: "invalid" } });
      if (phone !== order.customerPhone) {
        const customer = await upsertCustomer(tx, { phone, name: input.customerName ?? order.customerName });
        data.customerId = customer.id;
        setIfChanged("customerPhone", phone);
      }
    }
    setIfChanged("customerName", input.customerName);
    setIfChanged("customerEmail", input.customerEmail);
    for (const key of ["region", "city", "street", "house", "apartment", "postalCode", "comment", "trackingNumber", "managerNote"] as const) {
      setIfChanged(key, input[key]);
    }

    if (input.deliveryMethodId !== undefined && input.deliveryMethodId !== order.deliveryMethodId) {
      const method = input.deliveryMethodId ? await tx.deliveryMethod.findUnique({ where: { id: input.deliveryMethodId } }) : null;
      data.deliveryMethodId = method?.id ?? null;
      data.deliveryKind = method?.kind ?? null;
      data.deliveryName = method?.nameRu ?? null;
      changed.push("deliveryMethodId");
    }
    if (input.paymentMethodId !== undefined && input.paymentMethodId !== order.paymentMethodId) {
      const method = input.paymentMethodId ? await tx.paymentMethod.findUnique({ where: { id: input.paymentMethodId } }) : null;
      data.paymentMethodId = method?.id ?? null;
      data.paymentKind = method?.kind ?? null;
      data.paymentName = method?.nameRu ?? null;
      changed.push("paymentMethodId");
    }
    if (input.deliveryPrice !== undefined && input.deliveryPrice !== order.deliveryPrice) {
      data.deliveryPrice = input.deliveryPrice;
      data.total = order.itemsTotal - order.promoDiscount + input.deliveryPrice;
      changed.push("deliveryPrice");
    }

    if (!changed.length) return { changed: [] as string[] };
    await tx.order.update({ where: { id: orderId }, data });
    const onlyNote = changed.length === 1 && changed[0] === "managerNote";
    const summary = `Изменено: ${changed.map((c) => FIELD_LABELS[c] ?? c).join(", ")}`;
    await tx.orderHistory.create({
      data: { orderId, kind: onlyNote ? "NOTE" : "EDIT", comment: onlyNote ? String(data.managerNote ?? "") : summary, staffUserId: actor.staffUserId },
    });
    await audit({ staffUserId: actor.staffUserId, action: "order.update", entityType: "order", entityId: orderId, summary: `Заказ №${order.number}. ${summary}`, ip: actor.ip }, tx);
    return { changed };
  });
}
