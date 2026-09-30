"use server";

import { getLocale } from "next-intl/server";
import { db } from "../db";
import { DomainError, type ActionResult } from "../errors";
import { run } from "./run";
import { checkoutInputSchema, placeWebsiteOrder, type CheckoutInput } from "../orders/place";
import { getCurrentCart } from "../store-session";
import { getCurrentUser } from "../auth/customer";
import { rateLimit } from "../rate-limit";
import { clientIp } from "../request";

export async function placeOrderAction(input: CheckoutInput): Promise<ActionResult<{ number: number; accessToken: string }>> {
  return run(async () => {
    const data = checkoutInputSchema.parse(input);
    const ip = (await clientIp()) ?? "unknown";
    if (!(await rateLimit(`checkout:${ip}`, 10, 600))) throw new DomainError("RATE_LIMITED", "Слишком много заказов подряд");
    const cart = await getCurrentCart();
    if (!cart) throw new DomainError("CART_EMPTY", "Корзина пуста");
    const user = await getCurrentUser();
    const locale = (await getLocale()) === "kk" ? "kk" : "ru";
    const result = await placeWebsiteOrder(data, { cartId: cart.id, userId: user?.id ?? null, locale });

    // привязка аккаунта к карточке клиента (CRM) и сохранение телефона в профиле
    if (user) {
      const order = await db.order.findUnique({ where: { id: result.orderId }, select: { customerId: true, customerPhone: true } });
      await db.user.update({
        where: { id: user.id },
        data: { customerId: order?.customerId ?? undefined, phone: user.phone ?? order?.customerPhone ?? undefined },
      });
    }
    return { number: result.number, accessToken: result.accessToken };
  });
}
