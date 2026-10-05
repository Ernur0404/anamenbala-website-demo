/** Контент витрины в админке: баннеры, блоки главной, страницы, вопросы-ответы, объявления, Instagram */
import { z } from "zod";
import { db } from "../db";
import type { Prisma } from "@/generated/prisma/client";
import { DomainError } from "../errors";
import { audit } from "../audit";
import { CacheTags, invalidateTags } from "../cache";
import { sanitizeHtml } from "../sanitize";
import { updateSetting } from "../settings";
import { slugify } from "@/lib/slug";
import { addDays, storeDayStart } from "@/lib/dates";
import type { AdminActor } from "./action";

const text = (max: number) => z.string().trim().max(max).optional().nullable();
const blank = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);
const dateKey = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]).optional().nullable();
const L = z.object({ ru: z.string().trim().max(2000).default(""), kk: z.string().trim().max(2000).default("") });

function done(actor: AdminActor, action: string, summary: string, entityType: string, entityId?: string) {
  invalidateTags(CacheTags.content);
  return audit({ staffUserId: actor.id, action, entityType, entityId, summary, ip: actor.ip });
}

/** Переставить запись среди соседей (sortOrder = позиция) */
async function reorder<T extends { id: string }>(rows: T[], id: string, direction: "up" | "down", update: (id: string, sortOrder: number) => Promise<unknown>) {
  const index = rows.findIndex((r) => r.id === id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= rows.length) return;
  [rows[index], rows[target]] = [rows[target], rows[index]];
  for (const [i, r] of rows.entries()) await update(r.id, i);
}

// ───────────── баннеры ─────────────

export const bannerSchema = z.object({
  id: z.string().optional().nullable(),
  placement: z.enum(["HOME_HERO", "HOME_PROMO"]),
  eyebrowRu: text(80),
  eyebrowKk: text(80),
  titleRu: z.string().trim().min(1).max(160),
  titleKk: text(160),
  textRu: text(400),
  textKk: text(400),
  scriptRu: text(80),
  scriptKk: text(80),
  buttonTextRu: text(40),
  buttonTextKk: text(40),
  url: z.string().trim().max(300).optional().nullable(),
  imageId: z.string().optional().nullable(),
  mobileImageId: z.string().optional().nullable(),
  features: z.array(z.object({ icon: z.string().max(40), ru: z.string().trim().max(60), kk: z.string().trim().max(60).default("") })).max(6).default([]),
  startsAt: dateKey,
  endsAt: dateKey,
  isActive: z.boolean(),
});

export async function saveBanner(raw: z.input<typeof bannerSchema>, actor: AdminActor) {
  const input = bannerSchema.parse(raw);
  const url = blank(input.url);
  if (url && !url.startsWith("/") && !/^https?:\/\//.test(url)) throw new DomainError("VALIDATION", "Ссылка", { fieldErrors: { url: "invalid" } });
  const data = {
    placement: input.placement,
    eyebrowRu: blank(input.eyebrowRu),
    eyebrowKk: blank(input.eyebrowKk),
    titleRu: input.titleRu,
    titleKk: blank(input.titleKk),
    textRu: blank(input.textRu),
    textKk: blank(input.textKk),
    scriptRu: blank(input.scriptRu),
    scriptKk: blank(input.scriptKk),
    buttonTextRu: blank(input.buttonTextRu),
    buttonTextKk: blank(input.buttonTextKk),
    url,
    imageId: input.imageId || null,
    mobileImageId: input.mobileImageId || null,
    features: input.features.filter((f) => f.ru) as Prisma.InputJsonValue,
    startsAt: input.startsAt ? storeDayStart(input.startsAt) : null,
    endsAt: input.endsAt ? addDays(storeDayStart(input.endsAt), 1) : null,
    isActive: input.isActive,
  };
  let id = input.id;
  if (id) await db.banner.update({ where: { id }, data });
  else {
    const last = await db.banner.findFirst({ where: { placement: input.placement }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
    id = (await db.banner.create({ data: { ...data, sortOrder: (last?.sortOrder ?? -1) + 1 } })).id;
  }
  await done(actor, input.id ? "banner.update" : "banner.create", `Баннер «${input.titleRu}»`, "banner", id);
  return { id };
}

export async function toggleBanner(id: string, isActive: boolean, actor: AdminActor) {
  const b = await db.banner.update({ where: { id }, data: { isActive } });
  await done(actor, "banner.toggle", `Баннер «${b.titleRu}»: ${isActive ? "показан" : "скрыт"}`, "banner", id);
}

export async function moveBanner(id: string, direction: "up" | "down", actor: AdminActor) {
  const banner = await db.banner.findUnique({ where: { id } });
  if (!banner) throw new DomainError("NOT_FOUND");
  const rows = await db.banner.findMany({ where: { placement: banner.placement }, orderBy: { sortOrder: "asc" }, select: { id: true } });
  await reorder(rows, id, direction, (rowId, sortOrder) => db.banner.update({ where: { id: rowId }, data: { sortOrder } }));
  await done(actor, "banner.sort", `Порядок баннеров`, "banner", id);
}

export async function deleteBanner(id: string, actor: AdminActor) {
  const b = await db.banner.delete({ where: { id } }).catch(() => null);
  if (!b) throw new DomainError("NOT_FOUND");
  await done(actor, "banner.delete", `Удалён баннер «${b.titleRu}»`, "banner", id);
}

// ───────────── блоки главной ─────────────

export const homeSectionSchema = z.object({
  id: z.string().min(1),
  titleRu: text(120),
  titleKk: text(120),
  isActive: z.boolean(),
  config: z
    .object({
      source: z.enum(["popular", "new", "sale", "category", "manual"]).optional(),
      categorySlug: z.string().max(100).optional().nullable(),
      productIds: z.array(z.string()).max(24).optional(),
      limit: z.number().int().min(1).max(24).optional(),
    })
    .default({}),
});

export async function saveHomeSection(raw: z.input<typeof homeSectionSchema>, actor: AdminActor) {
  const input = homeSectionSchema.parse(raw);
  const section = await db.homeSection.findUnique({ where: { id: input.id } });
  if (!section) throw new DomainError("NOT_FOUND");
  const old = (section.config ?? {}) as Record<string, unknown>;
  const config = { ...old, ...Object.fromEntries(Object.entries(input.config).filter(([, v]) => v !== undefined)) };
  await db.homeSection.update({ where: { id: input.id }, data: { titleRu: blank(input.titleRu), titleKk: blank(input.titleKk), isActive: input.isActive, config: config as Prisma.InputJsonValue } });
  await done(actor, "home.section", `Блок главной «${input.titleRu ?? section.type}»`, "home_section", input.id);
}

export async function toggleHomeSection(id: string, isActive: boolean, actor: AdminActor) {
  const s = await db.homeSection.update({ where: { id }, data: { isActive } });
  await done(actor, "home.section_toggle", `Блок главной ${s.type}: ${isActive ? "показан" : "скрыт"}`, "home_section", id);
}

export async function moveHomeSection(id: string, direction: "up" | "down", actor: AdminActor) {
  const rows = await db.homeSection.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true } });
  await reorder(rows, id, direction, (rowId, sortOrder) => db.homeSection.update({ where: { id: rowId }, data: { sortOrder } }));
  await done(actor, "home.section_sort", "Порядок блоков главной", "home_section", id);
}

export async function addProductsSection(actor: AdminActor) {
  const last = await db.homeSection.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  const s = await db.homeSection.create({ data: { type: "PRODUCTS", titleRu: "Подборка", titleKk: null, config: { source: "popular", limit: 8 }, isActive: false, sortOrder: (last?.sortOrder ?? -1) + 1 } });
  await done(actor, "home.section_add", "Добавлена подборка товаров на главную", "home_section", s.id);
  return { id: s.id };
}

export async function deleteHomeSection(id: string, actor: AdminActor) {
  const s = await db.homeSection.findUnique({ where: { id } });
  if (!s) throw new DomainError("NOT_FOUND");
  if (s.type !== "PRODUCTS") throw new DomainError("FORBIDDEN", "Можно удалить только подборку товаров");
  await db.homeSection.delete({ where: { id } });
  await done(actor, "home.section_delete", `Удалена подборка «${s.titleRu ?? ""}»`, "home_section", id);
}

// ───────────── страницы ─────────────

const aboutContent = z
  .object({
    intro: L.optional(),
    features: z.array(z.object({ icon: z.string().max(40), title: L })).max(8).optional(),
    valuesTitle: L.optional(),
    values: z.array(z.object({ icon: z.string().max(40), title: L, text: L })).max(8).optional(),
    quote: L.optional(),
    storyTitle: L.optional(),
    story: L.optional(),
    valuesImageId: z.string().nullable().optional(),
    storyImageId: z.string().nullable().optional(),
  })
  .passthrough();

export const pageSchema = z.object({
  id: z.string().optional().nullable(),
  slug: text(80),
  titleRu: z.string().trim().min(1).max(160),
  titleKk: text(160),
  subtitleRu: text(400),
  subtitleKk: text(400),
  scriptRu: text(80),
  scriptKk: text(80),
  heroImageId: z.string().optional().nullable(),
  bodyRu: z.string().max(100_000).optional().nullable(),
  bodyKk: z.string().max(100_000).optional().nullable(),
  content: aboutContent.optional().nullable(),
  isPublished: z.boolean(),
  showInFooter: z.boolean(),
  seoTitleRu: text(200),
  seoTitleKk: text(200),
  seoDescriptionRu: text(400),
  seoDescriptionKk: text(400),
});

const RESERVED = new Set(["catalog", "sale", "search", "cart", "checkout", "account", "favorites", "product", "order", "admin", "api", "kk", "ru", "p", "uploads"]);

export async function savePage(raw: z.input<typeof pageSchema>, actor: AdminActor) {
  const input = pageSchema.parse(raw);
  const existing = input.id ? await db.page.findUnique({ where: { id: input.id } }) : null;
  if (input.id && !existing) throw new DomainError("NOT_FOUND");
  let slug = existing?.slug;
  if (!existing || !existing.isSystem) {
    slug = slugify(blank(input.slug) ?? input.titleRu) || "stranica";
    if (RESERVED.has(slug)) slug = `${slug}-info`;
    const clash = await db.page.findUnique({ where: { slug }, select: { id: true } });
    if (clash && clash.id !== existing?.id) throw new DomainError("CONFLICT", "Адрес занят", { fieldErrors: { slug: "CONFLICT" } });
  }
  const html = (v: string | null | undefined) => {
    const clean = v ? sanitizeHtml(v).trim() : "";
    return clean.replace(/<p>\s*<\/p>/g, "").trim() ? clean : null;
  };
  const data = {
    slug: slug!,
    titleRu: input.titleRu,
    titleKk: blank(input.titleKk),
    subtitleRu: blank(input.subtitleRu),
    subtitleKk: blank(input.subtitleKk),
    scriptRu: blank(input.scriptRu),
    scriptKk: blank(input.scriptKk),
    heroImageId: input.heroImageId || null,
    bodyRu: html(input.bodyRu),
    bodyKk: html(input.bodyKk),
    ...(input.content ? { content: input.content as Prisma.InputJsonValue } : {}),
    isPublished: existing?.template === "HERO_ONLY" ? true : input.isPublished,
    showInFooter: input.showInFooter,
    seoTitleRu: blank(input.seoTitleRu),
    seoTitleKk: blank(input.seoTitleKk),
    seoDescriptionRu: blank(input.seoDescriptionRu),
    seoDescriptionKk: blank(input.seoDescriptionKk),
  };
  const page = existing ? await db.page.update({ where: { id: existing.id }, data }) : await db.page.create({ data: { ...data, template: "DEFAULT" } });
  await done(actor, existing ? "page.update" : "page.create", `Страница «${page.titleRu}»`, "page", page.id);
  return { id: page.id };
}

export async function deletePage(id: string, actor: AdminActor) {
  const page = await db.page.findUnique({ where: { id } });
  if (!page) throw new DomainError("NOT_FOUND");
  if (page.isSystem) throw new DomainError("FORBIDDEN", "Системную страницу удалить нельзя");
  await db.page.delete({ where: { id } });
  await done(actor, "page.delete", `Удалена страница «${page.titleRu}»`, "page", id);
}

// ───────────── вопросы и ответы ─────────────

export const faqSchema = z.object({
  id: z.string().optional().nullable(),
  questionRu: z.string().trim().min(1).max(300),
  questionKk: text(300),
  answerRu: z.string().trim().min(1).max(3000),
  answerKk: text(3000),
  isActive: z.boolean(),
  showOnDelivery: z.boolean(),
});

export async function saveFaq(raw: z.input<typeof faqSchema>, actor: AdminActor) {
  const input = faqSchema.parse(raw);
  const data = { questionRu: input.questionRu, questionKk: blank(input.questionKk), answerRu: input.answerRu, answerKk: blank(input.answerKk), isActive: input.isActive, showOnDelivery: input.showOnDelivery };
  let id = input.id;
  if (id) await db.faqItem.update({ where: { id }, data });
  else {
    const last = await db.faqItem.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
    id = (await db.faqItem.create({ data: { ...data, sortOrder: (last?.sortOrder ?? -1) + 1 } })).id;
  }
  await done(actor, input.id ? "faq.update" : "faq.create", `Вопрос «${input.questionRu.slice(0, 80)}»`, "faq", id);
  return { id };
}

export async function moveFaq(id: string, direction: "up" | "down", actor: AdminActor) {
  const rows = await db.faqItem.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true } });
  await reorder(rows, id, direction, (rowId, sortOrder) => db.faqItem.update({ where: { id: rowId }, data: { sortOrder } }));
  await done(actor, "faq.sort", "Порядок вопросов", "faq", id);
}

export async function deleteFaq(id: string, actor: AdminActor) {
  await db.faqItem.delete({ where: { id } }).catch(() => null);
  await done(actor, "faq.delete", "Удалён вопрос", "faq", id);
}

// ───────────── объявления (колокольчик «Уведомления» на сайте) ─────────────

export const announcementSchema = z.object({
  id: z.string().optional().nullable(),
  titleRu: z.string().trim().min(1).max(120),
  titleKk: text(120),
  textRu: text(600),
  textKk: text(600),
  url: z.string().trim().max(300).optional().nullable(),
  startsAt: dateKey,
  endsAt: dateKey,
  isActive: z.boolean(),
});

export async function saveAnnouncement(raw: z.input<typeof announcementSchema>, actor: AdminActor) {
  const input = announcementSchema.parse(raw);
  const url = blank(input.url);
  if (url && !url.startsWith("/") && !/^https?:\/\//.test(url)) throw new DomainError("VALIDATION", "Ссылка", { fieldErrors: { url: "invalid" } });
  const startsAt = input.startsAt ? storeDayStart(input.startsAt) : null;
  const endsAt = input.endsAt ? addDays(storeDayStart(input.endsAt), 1) : null;
  if (startsAt && endsAt && endsAt <= startsAt) throw new DomainError("VALIDATION", "Окончание раньше начала", { fieldErrors: { endsAt: "invalid" } });
  const data = {
    titleRu: input.titleRu,
    titleKk: blank(input.titleKk),
    textRu: blank(input.textRu),
    textKk: blank(input.textKk),
    url,
    startsAt,
    endsAt,
    isActive: input.isActive,
  };
  const id = input.id ? (await db.announcement.update({ where: { id: input.id }, data })).id : (await db.announcement.create({ data })).id;
  await done(actor, input.id ? "announcement.update" : "announcement.create", `Объявление «${input.titleRu.slice(0, 80)}»`, "announcement", id);
  return { id };
}

export async function toggleAnnouncement(id: string, isActive: boolean, actor: AdminActor) {
  const a = await db.announcement.update({ where: { id }, data: { isActive } });
  await done(actor, "announcement.toggle", `Объявление «${a.titleRu.slice(0, 80)}»: ${isActive ? "показано" : "скрыто"}`, "announcement", id);
}

export async function deleteAnnouncement(id: string, actor: AdminActor) {
  const a = await db.announcement.delete({ where: { id } }).catch(() => null);
  if (!a) throw new DomainError("NOT_FOUND");
  await done(actor, "announcement.delete", `Удалено объявление «${a.titleRu.slice(0, 80)}»`, "announcement", id);
}

// ───────────── Instagram ─────────────

export const instagramSchema = z.object({
  id: z.string().optional().nullable(),
  mediaId: z.string().min(1),
  url: z.string().trim().url().max(300),
  isActive: z.boolean(),
});

export async function saveInstagramPost(raw: z.input<typeof instagramSchema>, actor: AdminActor) {
  const input = instagramSchema.parse(raw);
  let id = input.id;
  if (id) await db.instagramPost.update({ where: { id }, data: { mediaId: input.mediaId, url: input.url, isActive: input.isActive } });
  else {
    const last = await db.instagramPost.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
    id = (await db.instagramPost.create({ data: { mediaId: input.mediaId, url: input.url, isActive: input.isActive, sortOrder: (last?.sortOrder ?? -1) + 1 } })).id;
  }
  await done(actor, "instagram.save", "Пост Instagram", "instagram", id);
  return { id };
}

export async function moveInstagramPost(id: string, direction: "up" | "down", actor: AdminActor) {
  const rows = await db.instagramPost.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true } });
  await reorder(rows, id, direction, (rowId, sortOrder) => db.instagramPost.update({ where: { id: rowId }, data: { sortOrder } }));
  await done(actor, "instagram.sort", "Порядок постов Instagram", "instagram", id);
}

export async function deleteInstagramPost(id: string, actor: AdminActor) {
  await db.instagramPost.delete({ where: { id } }).catch(() => null);
  await done(actor, "instagram.delete", "Удалён пост Instagram", "instagram", id);
}

// ───────────── инфо-полоса и преимущества (настройки) ─────────────

export const topbarSchema = z.object({ items: z.array(z.object({ icon: z.string().max(40), text: L })).max(5) });
export const advantagesSchema = z.object({ items: z.array(z.object({ icon: z.string().max(40), title: L, text: L })).max(6) });

export async function saveTopbar(raw: z.input<typeof topbarSchema>, actor: AdminActor) {
  const input = topbarSchema.parse(raw);
  await updateSetting("topbar", { items: input.items.filter((i) => i.text.ru) }, { staffUserId: actor.id, ip: actor.ip });
  invalidateTags(CacheTags.content);
}

export async function saveAdvantages(raw: z.input<typeof advantagesSchema>, actor: AdminActor) {
  const input = advantagesSchema.parse(raw);
  await updateSetting("advantages", { items: input.items.filter((i) => i.title.ru) }, { staffUserId: actor.id, ip: actor.ip });
  invalidateTags(CacheTags.content);
}

