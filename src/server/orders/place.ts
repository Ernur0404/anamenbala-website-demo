/** Оформление заказа на сайте */
import { z } from "zod";
import { db, transaction } from "../db";
import { DomainError } from "../errors";
import { normalizePhone } from "@/lib/phone";
import type { DeliveryKind } from "@/generated/prisma/enums";
import { buildQuote, normalizePromoCode } from "./quote";
import { createOrderRecord } from "./create";
import { isUniqueViolation } from "./helpers";
import { afterStockChange } from "../stock-effects";
import { notifyNewOrder } from "../notifications";

const optionalText = (max: number) => z.string().trim().max(max).optional();

export const checkoutInputSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(10).max(30),
  email: z.union([z.string().trim().email().max(200), z.literal("")]).optional(),
  deliveryMethodId: z.string().min(1),
  region: optionalText(120),
  city: optionalText(120),
  street: optionalText(200),
  house: optionalText(40),
  apartment: optionalText(40),
  postalCode: optionalText(20),
  paymentMethodId: z.string().min(1),
  comment: optionalText(1000),
  promoCode: optionalText(40),
  consent: z.literal(true),
  idempotencyKey: z.string().min(8).max(100),
  expectedTotal: z.number().int().nonnegative().optional(),
});

export type CheckoutInput = z.infer<typeof checkoutInputSchema>;

type AddressInput = Pick<CheckoutInput, "city" | "street" | "house">;

/** Обязательные поля адреса зависят от способа доставки */
export function addressErrors(kind: DeliveryKind, input: AddressInput): Record<string, string> | null {
  const required: (keyof AddressInput)[] = kind === "PICKUP" ? [] : kind === "LOCAL_COURIER" ? ["street", "house"] : ["city", "street", "house"];
  const errors: Record<string, string> = {};
  for (const field of required) if (!input[field]?.trim()) errors[field] = "required";
  return Object.keys(errors).length ? errors : null;
}

export async function placeWebsiteOrder(
  input: CheckoutInput,
  ctx: { cartId: string; userId: string | null; locale: string },
): Promise<{ orderId: string; number: number; accessToken: string }> {
  const phone = normalizePhone(input.phone);
  if (!phone) throw new DomainError("VALIDATION", "Неверный номер телефона", { fieldErrors: { phone: "invalid" } });

  const existing = await db.order.findUnique({ where: { idempotencyKey: input.idempotencyKey }, select: { id: true, number: true, accessToken: true } });
  if (existing) return { orderId: existing.id, number: existing.number, accessToken: existing.accessToken };

  const cartItems = await db.cartItem.findMany({ where: { cartId: ctx.cartId }, select: { variantId: true, quantity: true } });
  if (!cartItems.length) throw new DomainError("CART_EMPTY", "Корзина пуста");

  try {
    const result = await transaction(async (tx) => {
      const delivery = await tx.deliveryMethod.findFirst({
        where: { id: input.deliveryMethodId, isActive: true },
        include: { paymentMethods: { select: { paymentMethodId: true } } },
      });
      if (!delivery) throw new DomainError("DELIVERY_UNAVAILABLE", "Способ доставки недоступен");
      const payment = await tx.paymentMethod.findFirst({ where: { id: input.paymentMethodId, isActive: true } });
      if (!payment) throw new DomainError("PAYMENT_UNAVAILABLE", "Способ оплаты недоступен");
      if (delivery.paymentMethods.length && !delivery.paymentMethods.some((p) => p.paymentMethodId === payment.id)) {
        throw new DomainError("PAYMENT_UNAVAILABLE", "Этот способ оплаты недоступен для выбранной доставки");
      }
      const fieldErrors = addressErrors(delivery.kind, input);
      if (fieldErrors) throw new DomainError("VALIDATION", "Заполните адрес доставки", { fieldErrors });

      const quote = await buildQuote(tx, {
        items: cartItems,
        deliveryMethodId: delivery.id,
        promoCode: input.promoCode,
        customerPhone: phone,
      });
      if (quote.problems.length) {
        const first = quote.problems[0];
        throw new DomainError(first.code, "Некоторые товары недоступны", { problems: quote.problems });
      }
      if (normalizePromoCode(input.promoCode) && quote.promoError) {
        throw new DomainError(quote.promoError.code, "Промокод не применён", { ...quote.promoError });
      }
      if (input.expectedTotal !== undefined && input.expectedTotal !== quote.totals.total) {
        throw new DomainError("PRICE_CHANGED", "Сумма заказа изменилась", { total: quote.totals.total });
      }

      const isPickup = delivery.kind === "PICKUP";
      const created = await createOrderRecord(tx, quote, {
        channel: "WEBSITE",
        customer: { name: input.name, phone, email: input.email || null },
        userId: ctx.userId,
        delivery: {
          method: delivery,
          region: isPickup ? null : input.region,
          city: isPickup ? null : input.city?.trim() || (delivery.kind === "LOCAL_COURIER" ? delivery.addressRu : null),
          street: isPickup ? null : input.street,
          house: isPickup ? null : input.house,
          apartment: isPickup ? null : input.apartment,
          postalCode: isPickup ? null : input.postalCode,
        },
        payment: { method: payment },
        comment: input.comment,
        locale: ctx.locale,
        idempotencyKey: input.idempotencyKey,
        backorder: "product",
        actor: { actor: "customer" },
      });

      await tx.cartItem.deleteMany({ where: { cartId: ctx.cartId } });
      await tx.cart.update({ where: { id: ctx.cartId }, data: { promoCode: null } });
      return { ...created, productIds: quote.lines.map((l) => l.productId) };
    });

    await afterStockChange(result.productIds, result.stockChanges.values());
    await notifyNewOrder(result.orderId).catch((e) => console.error("[notify]", e));
    return { orderId: result.orderId, number: result.number, accessToken: result.accessToken };
  } catch (error) {
    if (isUniqueViolation(error)) {
      const again = await db.order.findUnique({ where: { idempotencyKey: input.idempotencyKey }, select: { id: true, number: true, accessToken: true } });
      if (again) return { orderId: again.id, number: again.number, accessToken: again.accessToken };
    }
    throw error;
  }
}
