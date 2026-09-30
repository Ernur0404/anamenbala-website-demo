/**
 * Демо-данные: товары, фото (ссылки Unsplash), заказы и клиенты помечены isDemo;
 * бренды, акции и промокоды, созданные демо-наполнением, записаны в реестр (Setting "demo").
 * Удаление — одной кнопкой в админке (Настройки → Демо-данные) или командой.
 */
import { db } from "./db";
import { clearCache } from "./cache";
import type { Prisma } from "@/generated/prisma/client";

export type DemoRegistry = { brandIds: string[]; promotionIds: string[]; promoCodeIds: string[] };

const KEY = "demo";

export async function getDemoRegistry(): Promise<DemoRegistry> {
  const row = await db.setting.findUnique({ where: { key: KEY } });
  const value = (row?.value ?? {}) as Partial<DemoRegistry>;
  return { brandIds: value.brandIds ?? [], promotionIds: value.promotionIds ?? [], promoCodeIds: value.promoCodeIds ?? [] };
}

export async function saveDemoRegistry(registry: DemoRegistry) {
  await db.setting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: registry as unknown as Prisma.InputJsonValue },
    update: { value: registry as unknown as Prisma.InputJsonValue },
  });
}

export async function demoStats() {
  const [products, orders, customers, media, registry] = await Promise.all([
    db.product.count({ where: { isDemo: true } }),
    db.order.count({ where: { isDemo: true } }),
    db.customer.count({ where: { isDemo: true } }),
    db.media.count({ where: { isDemo: true } }),
    getDemoRegistry(),
  ]);
  return { products, orders, customers, media, brands: registry.brandIds.length, promotions: registry.promotionIds.length + registry.promoCodeIds.length };
}

export async function deleteDemoData() {
  const registry = await getDemoRegistry();
  const demoOrders = await db.order.findMany({ where: { isDemo: true }, select: { id: true } });
  const demoOrderIds = demoOrders.map((o) => o.id);

  await db.$transaction(async (tx) => {
    await tx.promoRedemption.deleteMany({ where: { orderId: { in: demoOrderIds } } });
    await tx.order.deleteMany({ where: { id: { in: demoOrderIds } } });
    await tx.customer.deleteMany({ where: { isDemo: true, orders: { none: {} } } });
    await tx.product.deleteMany({ where: { isDemo: true } });
    await tx.instagramPost.deleteMany({ where: { isDemo: true } });
    await tx.promoCode.deleteMany({ where: { id: { in: registry.promoCodeIds } } });
    await tx.promotion.deleteMany({ where: { id: { in: registry.promotionIds } } });
    await tx.brand.deleteMany({ where: { id: { in: registry.brandIds }, products: { none: {} } } });
    // демо-фото — внешние ссылки, файлов на диске нет; ссылки в баннерах и категориях обнулятся (SetNull)
    await tx.media.deleteMany({ where: { isDemo: true } });
    await tx.setting.deleteMany({ where: { key: KEY } });
  }, { timeout: 60_000 });

  clearCache();
}
