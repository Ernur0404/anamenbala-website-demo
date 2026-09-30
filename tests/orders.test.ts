import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { placeWebsiteOrder } from "@/server/orders/place";
import { changeOrderStatus, changePaymentStatus, orderTransitionAllowed } from "@/server/orders/status";
import { createManualOrder, createPosSale } from "@/server/orders/staff";
import { updateOrderItems } from "@/server/orders/edit";
import { DomainError } from "@/server/errors";
import { cartWith, checkoutInput, createCatalog, createStaff, hasTestDb, resetDb, stockOf } from "./helpers/fixtures";

describe.skipIf(!hasTestDb)("заказы и остатки", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("оформление с сайта списывает остаток, сохраняет историю и клиента, очищает корзину", async () => {
    const c = await createCatalog({ stock80: 5 });
    const cart = await cartWith([{ variantId: c.v80.id, quantity: 2 }]);
    const res = await placeWebsiteOrder(checkoutInput({ deliveryMethodId: c.courier.id, paymentMethodId: c.kaspi.id }), {
      cartId: cart.id,
      userId: null,
      locale: "ru",
    });

    const order = await db.order.findUniqueOrThrow({ where: { id: res.orderId }, include: { items: true, history: true, customer: true } });
    expect(order.status).toBe("NEW");
    expect(order.itemsTotal).toBe(12_000);
    expect(order.deliveryPrice).toBe(500);
    expect(order.total).toBe(12_500);
    expect(order.city).toBe("Ганюшкино");
    expect(order.items[0]).toMatchObject({ sku: "DV-80", quantity: 2, variantLabelRu: "Размер: 80", costPrice: 3_500 });
    expect(order.history.map((h) => h.kind)).toEqual(["CREATED"]);
    expect(order.customer?.phone).toBe("+77787077590");
    expect(await stockOf(c.v80.id)).toBe(3);
    expect(await db.cartItem.count({ where: { cartId: cart.id } })).toBe(0);
    const movement = await db.stockMovement.findFirstOrThrow({ where: { variantId: c.v80.id } });
    expect(movement).toMatchObject({ delta: -2, balanceAfter: 3, reason: "ORDER_PLACED", orderId: order.id });
  });

  it("повторная отправка формы (тот же ключ) не создаёт второй заказ", async () => {
    const c = await createCatalog();
    const cart = await cartWith([{ variantId: c.v80.id, quantity: 1 }]);
    const input = checkoutInput({ deliveryMethodId: c.pickup.id, paymentMethodId: c.onDelivery.id });
    const a = await placeWebsiteOrder(input, { cartId: cart.id, userId: null, locale: "ru" });
    const b = await placeWebsiteOrder(input, { cartId: cart.id, userId: null, locale: "ru" });
    expect(b.orderId).toBe(a.orderId);
    expect(await db.order.count()).toBe(1);
  });

  it("последний размер нельзя продать двоим одновременно", async () => {
    const c = await createCatalog({ stock100: 1 });
    const cartA = await cartWith([{ variantId: c.v100.id, quantity: 1 }]);
    const cartB = await cartWith([{ variantId: c.v100.id, quantity: 1 }]);
    const results = await Promise.allSettled([
      placeWebsiteOrder(checkoutInput({ deliveryMethodId: c.pickup.id, paymentMethodId: c.kaspi.id }), { cartId: cartA.id, userId: null, locale: "ru" }),
      placeWebsiteOrder(checkoutInput({ deliveryMethodId: c.pickup.id, paymentMethodId: c.kaspi.id, phone: "+77011234567" }), {
        cartId: cartB.id,
        userId: null,
        locale: "ru",
      }),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0].reason as DomainError).code).toBe("OUT_OF_STOCK");
    expect(await stockOf(c.v100.id)).toBe(0);
  });

  it("отмена возвращает товар на склад, повторный возврат оплаты не удваивает остаток", async () => {
    const owner = await createStaff("OWNER");
    const c = await createCatalog({ stock80: 5 });
    const cart = await cartWith([{ variantId: c.v80.id, quantity: 3 }]);
    const { orderId } = await placeWebsiteOrder(checkoutInput({ deliveryMethodId: c.pickup.id, paymentMethodId: c.kaspi.id }), {
      cartId: cart.id,
      userId: null,
      locale: "ru",
    });
    expect(await stockOf(c.v80.id)).toBe(2);
    const actor = { staffUserId: owner.id, role: owner.role };

    await changePaymentStatus({ orderId, to: "PAID", actor });
    const paid = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(paid.status).toBe("CONFIRMED"); // автоподтверждение после оплаты

    await changeOrderStatus({ orderId, to: "CANCELLED", comment: "Клиент передумал", actor });
    expect(await stockOf(c.v80.id)).toBe(5);

    await changePaymentStatus({ orderId, to: "REFUNDED", actor });
    expect(await stockOf(c.v80.id)).toBe(5);

    const product = await db.product.findUniqueOrThrow({ where: { id: c.product.id } });
    expect(product.salesCount).toBe(0);
    const history = await db.orderHistory.findMany({ where: { orderId }, orderBy: { createdAt: "asc" } });
    expect(history.map((h) => `${h.kind}:${h.toValue ?? ""}`)).toEqual(["CREATED:NEW", "PAYMENT:PAID", "STATUS:CONFIRMED", "STATUS:CANCELLED", "PAYMENT:REFUNDED"]);
  });

  it("возврат после доставки возвращает товар один раз", async () => {
    const owner = await createStaff("OWNER");
    const actor = { staffUserId: owner.id, role: owner.role };
    const c = await createCatalog({ stock80: 4 });
    const cart = await cartWith([{ variantId: c.v80.id, quantity: 2 }]);
    const { orderId } = await placeWebsiteOrder(checkoutInput({ deliveryMethodId: c.pickup.id, paymentMethodId: c.onDelivery.id }), {
      cartId: cart.id,
      userId: null,
      locale: "ru",
    });
    await changeOrderStatus({ orderId, to: "DELIVERED", actor });
    await changePaymentStatus({ orderId, to: "PAID", actor });
    expect(await stockOf(c.v80.id)).toBe(2);
    await changePaymentStatus({ orderId, to: "REFUNDED", actor });
    expect(await stockOf(c.v80.id)).toBe(4);
    await expect(changePaymentStatus({ orderId, to: "REFUNDED", actor })).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    expect(await stockOf(c.v80.id)).toBe(4);
  });

  it("«под заказ»: недостающее количество не списывается и не возвращается", async () => {
    const owner = await createStaff("OWNER");
    const c = await createCatalog({ stock100: 1, allowBackorder: true });
    const cart = await cartWith([{ variantId: c.v100.id, quantity: 3 }]);
    const { orderId } = await placeWebsiteOrder(checkoutInput({ deliveryMethodId: c.pickup.id, paymentMethodId: c.kaspi.id }), {
      cartId: cart.id,
      userId: null,
      locale: "ru",
    });
    const item = await db.orderItem.findFirstOrThrow({ where: { orderId } });
    expect(item).toMatchObject({ quantity: 3, backorderQty: 2 });
    expect(await stockOf(c.v100.id)).toBe(0);
    await changeOrderStatus({ orderId, to: "CANCELLED", actor: { staffUserId: owner.id, role: owner.role } });
    expect(await stockOf(c.v100.id)).toBe(1);
  });

  it("права на смену статусов", () => {
    expect(orderTransitionAllowed("NEW", "PACKING", "MANAGER")).toBe(true);
    expect(orderTransitionAllowed("PACKING", "CONFIRMED", "MANAGER")).toBe(false);
    expect(orderTransitionAllowed("PACKING", "CONFIRMED", "OWNER")).toBe(true);
    expect(orderTransitionAllowed("CANCELLED", "NEW", "MANAGER")).toBe(false);
    expect(orderTransitionAllowed("CANCELLED", "NEW", "OWNER")).toBe(true);
    expect(orderTransitionAllowed("COMPLETED", "CANCELLED", "MANAGER")).toBe(false);
    expect(orderTransitionAllowed("SHIPPED", "CANCELLED", "MANAGER")).toBe(true);
  });

  it("восстановление отменённого заказа снова резервирует товар", async () => {
    const owner = await createStaff("OWNER");
    const actor = { staffUserId: owner.id, role: owner.role };
    const c = await createCatalog({ stock80: 3 });
    const cart = await cartWith([{ variantId: c.v80.id, quantity: 2 }]);
    const { orderId } = await placeWebsiteOrder(checkoutInput({ deliveryMethodId: c.pickup.id, paymentMethodId: c.kaspi.id }), {
      cartId: cart.id,
      userId: null,
      locale: "ru",
    });
    await changeOrderStatus({ orderId, to: "CANCELLED", actor });
    expect(await stockOf(c.v80.id)).toBe(3);
    await changeOrderStatus({ orderId, to: "CONFIRMED", actor });
    expect(await stockOf(c.v80.id)).toBe(1);
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.stockReserved).toBe(true);
    expect(order.cancelledAt).toBeNull();
  });

  it("касса продаёт только то, что есть на складе, и сразу завершает заказ", async () => {
    const manager = await createStaff("MANAGER");
    const actor = { staffUserId: manager.id, role: manager.role };
    const c = await createCatalog({ stock80: 2, allowBackorder: true });
    await expect(createPosSale({ items: [{ variantId: c.v80.id, quantity: 3 }], payment: "CASH" }, actor)).rejects.toMatchObject({ code: "OUT_OF_STOCK" });
    const sale = await createPosSale({ items: [{ variantId: c.v80.id, quantity: 2 }], payment: "KASPI" }, actor);
    const order = await db.order.findUniqueOrThrow({ where: { id: sale.orderId }, include: { payments: true } });
    expect(order).toMatchObject({ channel: "POS", status: "COMPLETED", paymentStatus: "PAID", paymentName: "Kaspi QR", customerId: null });
    expect(order.payments[0]).toMatchObject({ status: "SUCCEEDED", amount: 12_000 });
    expect(await stockOf(c.v80.id)).toBe(0);
    const movement = await db.stockMovement.findFirstOrThrow({ where: { orderId: sale.orderId } });
    expect(movement.reason).toBe("POS_SALE");
  });

  it("ручной заказ из WhatsApp и редактирование состава с корректировкой остатков", async () => {
    const manager = await createStaff("MANAGER");
    const actor = { staffUserId: manager.id, role: manager.role };
    const c = await createCatalog({ stock80: 5, stock100: 2 });
    const created = await createManualOrder(
      {
        source: "WhatsApp",
        customerName: "Гульнар",
        customerPhone: "87011112233",
        items: [{ variantId: c.v80.id, quantity: 1, unitPrice: 5_500 }],
        deliveryMethodId: c.courier.id,
        street: "Сатпаева",
        house: "3",
        status: "CONFIRMED",
        paymentStatus: "UNPAID",
      },
      actor,
    );
    let order = await db.order.findUniqueOrThrow({ where: { id: created.orderId } });
    expect(order).toMatchObject({ channel: "MANUAL", source: "WhatsApp", status: "CONFIRMED", itemsTotal: 5_500, deliveryPrice: 500, total: 6_000 });
    expect(await stockOf(c.v80.id)).toBe(4);

    await updateOrderItems(
      created.orderId,
      {
        items: [
          { variantId: c.v80.id, quantity: 3 },
          { variantId: c.v100.id, quantity: 2 },
        ],
      },
      actor,
    );
    expect(await stockOf(c.v80.id)).toBe(2);
    expect(await stockOf(c.v100.id)).toBe(0);
    order = await db.order.findUniqueOrThrow({ where: { id: created.orderId } });
    expect(order.itemsTotal).toBe(30_000);
    expect(order.total).toBe(30_500);

    await updateOrderItems(created.orderId, { items: [{ variantId: c.v100.id, quantity: 1 }] }, actor);
    expect(await stockOf(c.v80.id)).toBe(5);
    expect(await stockOf(c.v100.id)).toBe(1);

    await expect(updateOrderItems(created.orderId, { items: [{ variantId: c.v100.id, quantity: 5 }] }, actor)).rejects.toMatchObject({
      code: "OUT_OF_STOCK",
    });
  });

  it("промокод: учёт использований и освобождение при отмене", async () => {
    const owner = await createStaff("OWNER");
    const c = await createCatalog({ stock80: 10 });
    await db.promoCode.create({ data: { code: "MAMA10", type: "PERCENT", value: 10, maxUses: 1 } });

    const cart1 = await cartWith([{ variantId: c.v80.id, quantity: 1 }]);
    const first = await placeWebsiteOrder(checkoutInput({ deliveryMethodId: c.pickup.id, paymentMethodId: c.kaspi.id, promoCode: "mama10" }), {
      cartId: cart1.id,
      userId: null,
      locale: "ru",
    });
    const order = await db.order.findUniqueOrThrow({ where: { id: first.orderId } });
    expect(order.promoDiscount).toBe(600);
    expect(order.total).toBe(5_400);
    expect((await db.promoCode.findUniqueOrThrow({ where: { code: "MAMA10" } })).usedCount).toBe(1);

    const cart2 = await cartWith([{ variantId: c.v80.id, quantity: 1 }]);
    await expect(
      placeWebsiteOrder(checkoutInput({ deliveryMethodId: c.pickup.id, paymentMethodId: c.kaspi.id, promoCode: "MAMA10", phone: "+77015556677" }), {
        cartId: cart2.id,
        userId: null,
        locale: "ru",
      }),
    ).rejects.toMatchObject({ code: "PROMO_LIMIT" });

    await changeOrderStatus({ orderId: first.orderId, to: "CANCELLED", actor: { staffUserId: owner.id, role: owner.role } });
    expect((await db.promoCode.findUniqueOrThrow({ where: { code: "MAMA10" } })).usedCount).toBe(0);
  });

  it("проверка суммы: если цена изменилась — заказ не оформляется молча", async () => {
    const c = await createCatalog({ stock80: 5 });
    const cart = await cartWith([{ variantId: c.v80.id, quantity: 1 }]);
    await db.product.update({ where: { id: c.product.id }, data: { price: 7_000 } });
    await expect(
      placeWebsiteOrder(checkoutInput({ deliveryMethodId: c.pickup.id, paymentMethodId: c.kaspi.id, expectedTotal: 6_000 }), {
        cartId: cart.id,
        userId: null,
        locale: "ru",
      }),
    ).rejects.toMatchObject({ code: "PRICE_CHANGED", details: { total: 7_000 } });
  });

  it("адрес обязателен для курьера", async () => {
    const c = await createCatalog();
    const cart = await cartWith([{ variantId: c.v80.id, quantity: 1 }]);
    await expect(
      placeWebsiteOrder(checkoutInput({ deliveryMethodId: c.courier.id, paymentMethodId: c.kaspi.id, street: "", house: "" }), {
        cartId: cart.id,
        userId: null,
        locale: "ru",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION", details: { fieldErrors: { street: "required", house: "required" } } });
  });
});
