/**
 * Базовое наполнение (идемпотентно — можно запускать повторно):
 * характеристики, категории макета, метки, таблицы размеров, доставка/оплата, страницы, FAQ, блоки главной, баннеры.
 */
import { db } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";
import { ATTRIBUTES, BADGES, CATEGORIES, SIZE_CHARTS } from "./catalog-structure";
import { DELIVERY_METHODS, FAQ, HERO_BANNERS, HERO_PAGES, HOME_SECTIONS, PAGES, PAYMENT_METHODS, PROMO_BANNER } from "./content";

const json = (value: unknown) => value as Prisma.InputJsonValue;

export async function seedAttributes() {
  for (const [index, a] of ATTRIBUTES.entries()) {
    const attribute = await db.attribute.upsert({
      where: { code: a.code },
      create: { code: a.code, nameRu: a.ru, nameKk: a.kk, type: a.type, display: a.display, isVariantAxis: a.axis, unit: a.unit, sortOrder: index },
      update: {},
    });
    for (const [i, v] of a.values.entries()) {
      await db.attributeValue.upsert({
        where: { attributeId_slug: { attributeId: attribute.id, slug: v.slug } },
        create: { attributeId: attribute.id, slug: v.slug, valueRu: v.ru, valueKk: v.kk, colorHex: v.hex, sortOrder: i },
        update: {},
      });
    }
  }
}

export async function seedSizeCharts() {
  const ids: Record<string, string> = {};
  for (const [key, chart] of Object.entries(SIZE_CHARTS)) {
    const existing = await db.sizeChart.findFirst({ where: { nameRu: chart.ru } });
    const record =
      existing ??
      (await db.sizeChart.create({
        data: { nameRu: chart.ru, nameKk: chart.kk, noteRu: chart.noteRu, noteKk: chart.noteKk, columns: json(chart.columns), rows: json(chart.rows) },
      }));
    ids[key] = record.id;
  }
  return ids;
}

export async function seedCategories(sizeCharts: Record<string, string>) {
  const attributes = await db.attribute.findMany();
  const attrId = new Map(attributes.map((a) => [a.code, a.id]));

  for (const [index, c] of CATEGORIES.entries()) {
    const parent = await db.category.upsert({
      where: { slug: c.slug },
      create: {
        slug: c.slug,
        nameRu: c.ru,
        nameKk: c.kk,
        icon: c.icon,
        sortOrder: index,
        heroTitleRu: c.hero.titleRu,
        heroTitleKk: c.hero.titleKk,
        heroTextRu: c.hero.textRu,
        heroTextKk: c.hero.textKk,
        heroScriptRu: c.hero.scriptRu,
        heroScriptKk: c.hero.scriptKk,
        sizeChartId: c.sizeChart ? sizeCharts[c.sizeChart] : null,
      },
      update: {},
    });
    for (const [i, s] of c.children.entries()) {
      const child = await db.category.upsert({
        where: { slug: s.slug },
        create: {
          slug: s.slug,
          nameRu: s.ru,
          nameKk: s.kk,
          icon: s.icon,
          parentId: parent.id,
          sortOrder: i,
          heroTitleRu: s.ru,
          heroTitleKk: s.kk,
          heroTextRu: c.hero.textRu,
          heroTextKk: c.hero.textKk,
          heroScriptRu: c.hero.scriptRu,
          heroScriptKk: c.hero.scriptKk,
          sizeChartId: s.slug === "detskaya-odezhda" ? sizeCharts.kids : c.sizeChart && s.attributes.some((a) => a.startsWith("size")) ? sizeCharts[c.sizeChart] : null,
        },
        update: {},
      });
      for (const [k, code] of s.attributes.entries()) {
        const attributeId = attrId.get(code);
        if (!attributeId) continue;
        await db.categoryAttribute.upsert({
          where: { categoryId_attributeId: { categoryId: child.id, attributeId } },
          create: { categoryId: child.id, attributeId, sortOrder: k, isFilter: true },
          update: {},
        });
      }
    }
  }
}

export async function seedBadges() {
  for (const b of BADGES) {
    await db.badge.upsert({ where: { code: b.code }, create: { code: b.code, nameRu: b.ru, nameKk: b.kk, style: b.style, sortOrder: b.sortOrder }, update: {} });
  }
}

export async function seedDeliveryAndPayment() {
  if (await db.deliveryMethod.count()) return;
  const deliveries = new Map<string, string>();
  for (const d of DELIVERY_METHODS) {
    const { key, ...data } = d;
    const created = await db.deliveryMethod.create({ data: { ...data, kind: key } });
    deliveries.set(key, created.id);
  }
  for (const p of PAYMENT_METHODS) {
    const { key, deliveries: allowed, ...data } = p;
    const created = await db.paymentMethod.create({ data: { ...data, kind: key } });
    for (const kind of allowed) {
      const deliveryMethodId = deliveries.get(kind);
      if (deliveryMethodId) await db.deliveryPayment.create({ data: { deliveryMethodId, paymentMethodId: created.id } });
    }
  }
}

export async function seedPages() {
  for (const p of PAGES) {
    const { content, ...rest } = p;
    await db.page.upsert({
      where: { slug: p.slug },
      create: { ...rest, content: json(content ?? {}), isSystem: true },
      update: {},
    });
  }
  for (const p of HERO_PAGES) {
    await db.page.upsert({
      where: { slug: p.slug },
      create: { ...p, template: "HERO_ONLY", isSystem: true },
      update: {},
    });
  }
  if (!(await db.faqItem.count())) {
    await db.faqItem.createMany({
      data: FAQ.map((f, i) => ({ questionRu: f.qRu, questionKk: f.qKk, answerRu: f.aRu, answerKk: f.aKk, sortOrder: i })),
    });
  }
}

export async function seedHomeAndBanners() {
  if (!(await db.homeSection.count())) {
    await db.homeSection.createMany({
      data: HOME_SECTIONS.map((s, i) => ({ type: s.type, titleRu: s.titleRu, titleKk: s.titleKk, config: json(s.config), isActive: s.isActive, sortOrder: i })),
    });
  }
  if (!(await db.banner.count())) {
    for (const [i, b] of HERO_BANNERS.entries()) {
      await db.banner.create({ data: { ...b, placement: "HOME_HERO", sortOrder: i } });
    }
    const { features, ...promo } = PROMO_BANNER;
    await db.banner.create({ data: { ...promo, features: json(features), placement: "HOME_PROMO", sortOrder: 0 } });
  }
}

export async function seedBase() {
  await seedAttributes();
  const sizeCharts = await seedSizeCharts();
  await seedCategories(sizeCharts);
  await seedBadges();
  await seedDeliveryAndPayment();
  await seedPages();
  await seedHomeAndBanners();
}
