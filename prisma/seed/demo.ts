/**
 * npm run db:demo — демо-каталог, фото (Unsplash по ссылкам), баннеры, акции и демо-заказы.
 * Перед созданием удаляет прежние демо-данные. Всё демо удаляется кнопкой в админке.
 */
import "dotenv/config";
import { db } from "@/server/db";
import type { OrderStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { deleteDemoData, saveDemoRegistry, type DemoRegistry } from "@/server/demo";
import { registerExternalImage } from "@/server/media/upload";
import { refreshProductIndex } from "@/server/catalog/indexer";
import { clearCache } from "@/server/cache";
import { buildQuote } from "@/server/orders/quote";
import { createOrderRecord } from "@/server/orders/create";
import { lockOrder, releaseOrderStock } from "@/server/orders/helpers";
import { CONTENT_PHOTOS, DEMO_BRANDS, DEMO_CUSTOMERS, DEMO_PRODUCTS, PHOTOS } from "./demo-data";

const DAY = 86_400_000;
let seed = 20261001;
function rand() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T,>(items: readonly T[]) => items[Math.floor(rand() * items.length)];

function cartesian(axes: { code: string; values: string[] }[]): { code: string; slug: string }[][] {
  return axes.reduce<{ code: string; slug: string }[][]>((acc, axis) => acc.flatMap((combo) => axis.values.map((slug) => [...combo, { code: axis.code, slug }])), [[]]);
}

async function main() {
  console.log("Удаляю прежние демо-данные…");
  await deleteDemoData();

  const registry: DemoRegistry = { brandIds: [], promotionIds: [], promoCodeIds: [] };
  const mediaIds = new Map<number, string>();
  const media = async (n: number, alt: string) => {
    if (!PHOTOS[n]) throw new Error(`Нет фото №${n}`);
    const existing = mediaIds.get(n);
    if (existing) return existing;
    const created = await registerExternalImage(`https://images.unsplash.com/photo-${PHOTOS[n]}`, { alt, isDemo: true });
    mediaIds.set(n, created.id);
    return created.id;
  };

  const attributes = await db.attribute.findMany({ include: { values: true } });
  const attr = (code: string) => {
    const a = attributes.find((x) => x.code === code);
    if (!a) throw new Error(`Нет характеристики ${code} — сначала выполните npm run db:seed`);
    return a;
  };
  const value = (code: string, slug: string) => {
    const v = attr(code).values.find((x) => x.slug === slug);
    if (!v) throw new Error(`Нет значения ${code}=${slug}`);
    return v.id;
  };
  const categories = await db.category.findMany();
  const cat = (slug: string) => {
    const c = categories.find((x) => x.slug === slug);
    if (!c) throw new Error(`Нет категории ${slug}`);
    return c.id;
  };
  const badges = await db.badge.findMany();
  const badge = (code: string) => badges.find((b) => b.code === code)!.id;

  // ── бренды ──
  const brandIds: Record<string, string> = {};
  for (const b of DEMO_BRANDS) {
    const existing = await db.brand.findUnique({ where: { slug: b.slug } });
    if (existing) brandIds[b.slug] = existing.id;
    else {
      const created = await db.brand.create({ data: b });
      brandIds[b.slug] = created.id;
      registry.brandIds.push(created.id);
    }
  }

  // ── товары ──
  console.log(`Создаю ${DEMO_PRODUCTS.length} демо-товаров…`);
  const productIds: string[] = [];
  const now = Date.now();
  for (const [index, p] of DEMO_PRODUCTS.entries()) {
    const images: { n: number; id: string }[] = [];
    for (const n of p.images) images.push({ n, id: await media(n, p.ru) });
    const colorFor = (n: number) => {
      const entry = Object.entries(p.colorImages ?? {}).find(([, img]) => img === n);
      return entry ? value("color", entry[0]) : null;
    };
    const publishedAt = new Date(now - p.daysAgo * DAY - int(0, 20) * 3600_000);
    const description = `<p>${p.descRu}</p>${p.bullets ? `<ul>${p.bullets.map((b) => `<li>${b}</li>`).join("")}</ul>` : ""}`;

    const product = await db.product.create({
      data: {
        slug: p.slug,
        status: "PUBLISHED",
        nameRu: p.ru,
        nameKk: p.kk,
        subtitleRu: p.subRu ?? null,
        subtitleKk: p.subKk ?? null,
        descriptionRu: description,
        descriptionKk: p.descKk ? `<p>${p.descKk}</p>` : null,
        brandId: p.brand ? brandIds[p.brand] : null,
        primaryCategoryId: cat(p.categories[0]),
        price: p.price,
        salePrice: p.sale?.price ?? null,
        saleStartsAt: p.sale ? new Date(now - 2 * DAY) : null,
        saleEndsAt: p.sale ? new Date(now + p.sale.days * DAY) : null,
        costPrice: p.cost,
        allowBackorder: Boolean(p.backorder),
        backorderNoteRu: p.backorder?.ru ?? null,
        backorderNoteKk: p.backorder?.kk ?? null,
        isDemo: true,
        publishedAt,
        createdAt: publishedAt,
        categories: { create: p.categories.map((slug) => ({ categoryId: cat(slug) })) },
        badges: { create: (p.badges ?? []).map((code) => ({ badgeId: badge(code) })) },
        attributeValues: { create: Object.entries(p.attrs ?? {}).flatMap(([code, slugs]) => slugs.map((slug) => ({ attributeValueId: value(code, slug) }))) },
        specs: { create: (p.specs ?? []).map(([label, val], i) => ({ labelRu: label, valueRu: val, sortOrder: i })) },
        options: { create: (p.axes ?? []).map((a, i) => ({ attributeId: attr(a.code).id, sortOrder: i })) },
        media: { create: images.map(({ n, id }, i) => ({ mediaId: id, sortOrder: i, colorValueId: colorFor(n) })) },
      },
    });

    for (const [i, combo] of cartesian(p.axes ?? []).entries()) {
      const suffix = combo.map((c) => c.slug.toUpperCase().replace(/[^A-Z0-9]/g, "")).join("-");
      const sku = `DEMO-${String(index + 1).padStart(2, "0")}${suffix ? `-${suffix}` : ""}`;
      const priceOverride = combo.map((c) => p.priceBy?.[c.slug]).find((v) => v !== undefined) ?? null;
      const [min, max] = p.stock ?? [3, 18];
      let stock = int(min, max);
      if (!p.stock && rand() < 0.07) stock = 0;
      const variant = await db.productVariant.create({
        data: {
          productId: product.id,
          sku,
          price: priceOverride,
          stock,
          sortOrder: i,
          optionValues: { create: combo.map((c) => ({ attributeId: attr(c.code).id, attributeValueId: value(c.code, c.slug) })) },
        },
      });
      if (stock > 0) await db.stockMovement.create({ data: { variantId: variant.id, delta: stock, balanceAfter: stock, reason: "INITIAL", note: "Демо-остаток" } });
    }
    productIds.push(product.id);
  }

  // ── фото категорий, баннеров, страниц ──
  for (const [slug, n] of Object.entries(CONTENT_PHOTOS.categoryTiles)) {
    const category = categories.find((c) => c.slug === slug);
    if (category) await db.category.update({ where: { id: category.id }, data: { tileImageId: await media(n, category.nameRu) } });
  }
  for (const [slug, n] of Object.entries(CONTENT_PHOTOS.categoryHeroes)) {
    const category = categories.find((c) => c.slug === slug);
    if (category) await db.category.update({ where: { id: category.id }, data: { heroImageId: await media(n, category.nameRu) } });
  }
  const heroBanners = await db.banner.findMany({ where: { placement: "HOME_HERO" }, orderBy: { sortOrder: "asc" } });
  for (const [i, banner] of heroBanners.entries()) {
    const n = CONTENT_PHOTOS.heroBanners[i];
    if (n) await db.banner.update({ where: { id: banner.id }, data: { imageId: await media(n, banner.titleRu) } });
  }
  const promo = await db.banner.findFirst({ where: { placement: "HOME_PROMO" } });
  if (promo) await db.banner.update({ where: { id: promo.id }, data: { imageId: await media(CONTENT_PHOTOS.promoBanner, promo.titleRu) } });
  for (const [slug, n] of Object.entries(CONTENT_PHOTOS.pageHeroes)) {
    const page = await db.page.findUnique({ where: { slug } });
    if (page) await db.page.update({ where: { id: page.id }, data: { heroImageId: await media(n, page.titleRu) } });
  }
  const about = await db.page.findUnique({ where: { slug: "about" } });
  if (about) {
    const content = { ...((about.content ?? {}) as Record<string, unknown>), valuesImageId: await media(CONTENT_PHOTOS.aboutValues, "Наши ценности"), storyImageId: await media(CONTENT_PHOTOS.aboutStory, "Наша история") };
    await db.page.update({ where: { id: about.id }, data: { content: content as Prisma.InputJsonValue } });
  }
  const contacts = await db.setting.findUnique({ where: { key: "contacts" } });
  const instagramUrl = ((contacts?.value ?? {}) as { instagram?: string }).instagram || "https://www.instagram.com/ganyushkino_ana_men_bala/";
  for (const [i, n] of CONTENT_PHOTOS.instagram.entries()) {
    await db.instagramPost.create({ data: { mediaId: await media(n, "Instagram"), url: instagramUrl, sortOrder: i, isDemo: true } });
  }

  // ── акции ──
  const textile = await db.promotion.create({
    data: {
      nameRu: "−15% на текстиль для дома",
      nameKk: "Үй тоқымасына −15%",
      type: "PERCENT",
      value: 15,
      scope: "CATEGORY",
      startsAt: new Date(now - DAY),
      endsAt: new Date(now + 14 * DAY),
      categories: { create: [{ categoryId: cat("tekstil") }] },
    },
  });
  registry.promotionIds.push(textile.id);
  const existingCode = await db.promoCode.findUnique({ where: { code: "MAMA10" } });
  if (!existingCode) {
    const code = await db.promoCode.create({
      data: { code: "MAMA10", type: "PERCENT", value: 10, minOrderAmount: 10_000, maxUses: 200, endsAt: new Date(now + 30 * DAY), note: "Демо-промокод" },
    });
    registry.promoCodeIds.push(code.id);
  }

  // ── пример объявления в «Уведомлениях» (удаляется вместе с демо-данными) ──
  await db.announcement.create({
    data: {
      titleRu: "Мы открыли интернет-магазин!",
      titleKk: "Біз интернет-дүкен аштық!",
      textRu: "Теперь заказывать можно прямо на сайте — с доставкой по Ганюшкино и всему Казахстану",
      textKk: "Енді тапсырысты тікелей сайттан беруге болады — Ганюшкино мен бүкіл Қазақстан бойынша жеткізумен",
      url: "/delivery",
      isDemo: true,
    },
  });
  clearCache();
  await refreshProductIndex(productIds);

  // ── демо-заказы ──
  console.log("Создаю демо-заказы…");
  const deliveries = await db.deliveryMethod.findMany({ where: { isActive: true }, include: { paymentMethods: true } });
  const payments = await db.paymentMethod.findMany({ where: { isActive: true } });
  const owner = await db.staffUser.findFirst({ where: { role: "OWNER" } });
  const variants = await db.productVariant.findMany({ where: { product: { isDemo: true } }, select: { id: true } });
  const customers = DEMO_CUSTOMERS.map((name, i) => ({ name, phone: `+7700000${String(1000 + i * 37).padStart(4, "0")}` }));
  const streets = ["ул. Абая", "ул. Махамбета", "ул. Курмангазы", "мкр. Жастар", "ул. Сатпаева", "ул. Бейбитшилик"];

  let created = 0;
  for (let i = 0; i < 72; i++) {
    const daysAgo = Math.floor(Math.pow(rand(), 1.4) * 30);
    const createdAt = new Date(now - daysAgo * DAY - int(0, 9) * 3600_000 - int(0, 59) * 60_000);
    const customer = pick(customers);
    const lineCount = int(1, 3);
    const items = Array.from({ length: lineCount }, () => ({ variantId: pick(variants).id, quantity: rand() < 0.8 ? 1 : 2 }));
    const roll = rand();
    const channel = roll < 0.68 ? "WEBSITE" : roll < 0.88 ? "MANUAL" : "POS";
    const delivery = channel === "POS" ? null : pick(deliveries);
    const allowedPayments = delivery?.paymentMethods.length ? payments.filter((p) => delivery.paymentMethods.some((dp) => dp.paymentMethodId === p.id)) : payments;
    const payment = channel === "POS" ? null : pick(allowedPayments);

    try {
      await db.$transaction(
        async (tx) => {
          const quote = await buildQuote(tx, { items, deliveryMethodId: delivery?.id ?? null }, { allowUnpublished: true });
          if (quote.problems.length) return;
          const result = await createOrderRecord(tx, quote, {
            channel,
            source: channel === "MANUAL" ? pick(["WhatsApp", "Instagram", "Телефон"]) : channel === "POS" ? "Магазин" : null,
            status: channel === "POS" ? "COMPLETED" : "NEW",
            paymentStatus: channel === "POS" ? "PAID" : "UNPAID",
            customer: { name: customer.name, phone: channel === "POS" && rand() < 0.5 ? null : customer.phone },
            delivery: delivery
              ? {
                  method: delivery,
                  city: delivery.kind === "KAZAKHSTAN" ? pick(["Атырау", "Алматы", "Астана", "Уральск", "Актобе"]) : delivery.kind === "LOCAL_COURIER" ? "Ганюшкино" : null,
                  street: delivery.kind === "PICKUP" ? null : pick(streets),
                  house: delivery.kind === "PICKUP" ? null : String(int(1, 60)),
                }
              : undefined,
            payment: channel === "POS" ? { method: null, label: pick(["Наличные", "Карта", "Kaspi QR"]) } : { method: payment },
            createdById: channel === "WEBSITE" ? null : (owner?.id ?? null),
            isDemo: true,
            createdAt,
            backorder: "never",
            actor: channel === "WEBSITE" ? { actor: "customer" } : { staffUserId: owner?.id ?? null, actor: "system" },
          });
          if (channel === "POS") return;

          // развитие статусов в зависимости от давности заказа
          const isPickup = delivery?.kind === "PICKUP";
          let target: OrderStatus;
          if (rand() < 0.07) target = "CANCELLED";
          else if (daysAgo >= 7) target = rand() < 0.85 ? "COMPLETED" : "DELIVERED";
          else if (daysAgo >= 3) target = pick(["DELIVERED", "SHIPPED", "COMPLETED"] as const);
          else if (daysAgo >= 1) target = pick(["CONFIRMED", "PACKING", "SHIPPED"] as const);
          else target = pick(["NEW", "NEW", "CONFIRMED"] as const);
          if (isPickup && target === "SHIPPED") target = "PACKING";

          const flow: OrderStatus[] = ["CONFIRMED", "PACKING", "SHIPPED", "DELIVERED", "COMPLETED"].filter((s) => !(isPickup && s === "SHIPPED")) as OrderStatus[];
          const steps = target === "CANCELLED" ? (["CANCELLED"] as OrderStatus[]) : flow.slice(0, flow.indexOf(target) + 1);
          let previous: OrderStatus = "NEW";
          let at = createdAt.getTime();
          for (const step of steps) {
            at += int(2, 20) * 3600_000;
            await tx.orderHistory.create({
              data: { orderId: result.orderId, kind: "STATUS", fromValue: previous, toValue: step, staffUserId: owner?.id ?? null, createdAt: new Date(Math.min(at, now)) },
            });
            previous = step;
          }
          if (target === "CANCELLED") {
            const order = await lockOrder(tx, result.orderId);
            if (order) await releaseOrderStock(tx, order, "ORDER_CANCELLED", owner?.id ?? null);
          }
          const paid = target !== "CANCELLED" && target !== "NEW" && (["DELIVERED", "COMPLETED"].includes(target) || (payment?.kind === "KASPI" && rand() < 0.7));
          await tx.order.update({
            where: { id: result.orderId },
            data: {
              status: target,
              paymentStatus: paid ? "PAID" : "UNPAID",
              paidAt: paid ? new Date(Math.min(createdAt.getTime() + 6 * 3600_000, now)) : null,
              completedAt: target === "COMPLETED" ? new Date(Math.min(at, now)) : null,
              cancelledAt: target === "CANCELLED" ? new Date(Math.min(at, now)) : null,
              trackingNumber: delivery?.kind === "KAZAKHSTAN" && ["SHIPPED", "DELIVERED", "COMPLETED"].includes(target) ? `KZ${int(100000000, 999999999)}` : null,
            },
          });
          if (paid) {
            const order = await tx.order.findUniqueOrThrow({ where: { id: result.orderId } });
            await tx.payment.create({ data: { orderId: order.id, kind: order.paymentKind ?? "KASPI", amount: order.total, status: "SUCCEEDED", staffUserId: owner?.id ?? null, createdAt: order.paidAt ?? createdAt } });
            await tx.orderHistory.create({ data: { orderId: order.id, kind: "PAYMENT", fromValue: "UNPAID", toValue: "PAID", staffUserId: owner?.id ?? null, createdAt: order.paidAt ?? createdAt } });
          }
        },
        { timeout: 30_000 },
      );
      created++;
    } catch (error) {
      // нехватка остатка у случайно выбранного товара — просто пропускаем заказ
      if (!(error instanceof Error && /OUT_OF_STOCK|Недостаточно/.test(error.message))) console.warn("Заказ пропущен:", error instanceof Error ? error.message : error);
    }
  }

  await refreshProductIndex(productIds);
  await saveDemoRegistry(registry);
  clearCache();
  console.log(`Готово: ${productIds.length} товаров, ${mediaIds.size} фото, ${created} заказов.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
