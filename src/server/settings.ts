import { z } from "zod";
import { db } from "./db";
import { cached, CacheTags, invalidateTags } from "./cache";
import { audit } from "./audit";
import type { Prisma } from "@/generated/prisma/client";

const localized = (ru = "", kk = "") => z.object({ ru: z.string().default(ru), kk: z.string().default(kk) }).default({ ru, kk });

const tone = z.enum(["sage", "amber", "sky", "powder", "lavender", "graphite", "gray", "beige"]);
export type Tone = z.infer<typeof tone>;

const statusLabel = (ru: string, kk: string, t: Tone) =>
  z.object({ ru: z.string().default(ru), kk: z.string().default(kk), tone: tone.default(t) }).default({ ru, kk, tone: t });

const iconItem = (icon: string, ru: string, kk: string) => ({ icon, text: { ru, kk } });

export const settingsSchemas = {
  general: z.object({
    storeName: z.string().default("Ана мен бала"),
    tagline: localized("Для всей семьи", "Бүкіл отбасыға"),
    shortDescription: localized(
      "Товары для всей семьи. Качество, забота, удобство.",
      "Бүкіл отбасыға арналған тауарлар. Сапа, қамқорлық, ыңғайлылық.",
    ),
    logoMediaId: z.string().nullable().default(null),
    faviconMediaId: z.string().nullable().default(null),
    lowStockThreshold: z.number().int().min(0).max(1000).default(3),
    /** Сколько дней после публикации товар считается «новинкой» в подборке «Новинки» */
    newArrivalDays: z.number().int().min(1).max(365).default(45),
  }),

  contacts: z.object({
    phone: z.string().default("+77787077590"),
    whatsapp: z.string().default("+77787077590"),
    email: z.string().default(""),
    address: localized("с. Ганюшкино, ТД «Нұрсая», 2 этаж", "Ганюшкино а., «Нұрсая» СҮ, 2 қабат"),
    hours: localized("Ежедневно 09:00–18:00, обед 13:00–14:30", "Күн сайын 09:00–18:00, түскі үзіліс 13:00–14:30"),
    mapEmbedUrl: z
      .string()
      .default("https://www.openstreetmap.org/export/embed.html?bbox=49.2525%2C46.5955%2C49.2825%2C46.6105&layer=mapnik&marker=46.603%2C49.2675"),
    mapLink: z.string().default("https://www.openstreetmap.org/?mlat=46.603&mlon=49.2675#map=16/46.603/49.2675"),
    instagram: z.string().default("https://www.instagram.com/ganyushkino_ana_men_bala/"),
    tiktok: z.string().default(""),
    telegram: z.string().default(""),
  }),

  topbar: z.object({
    items: z
      .array(z.object({ icon: z.string(), text: z.object({ ru: z.string(), kk: z.string().default("") }) }))
      .default([
        iconItem("truck", "Бесплатная доставка от 15 000 ₸", "15 000 ₸-ден бастап тегін жеткізу"),
        iconItem("shield-check", "Гарантия качества", "Сапа кепілдігі"),
        iconItem("heart", "Забота о каждой семье", "Әр отбасына қамқорлық"),
      ]),
  }),

  advantages: z.object({
    items: z
      .array(
        z.object({
          icon: z.string(),
          title: z.object({ ru: z.string(), kk: z.string().default("") }),
          text: z.object({ ru: z.string().default(""), kk: z.string().default("") }),
        }),
      )
      .default([
        { icon: "truck", title: { ru: "Быстрая доставка", kk: "Жылдам жеткізу" }, text: { ru: "по всему Казахстану", kk: "бүкіл Қазақстан бойынша" } },
        { icon: "shield-check", title: { ru: "Гарантия качества", kk: "Сапа кепілдігі" }, text: { ru: "на все товары", kk: "барлық тауарларға" } },
        { icon: "message-circle", title: { ru: "Всегда на связи", kk: "Әрдайым байланыстамыз" }, text: { ru: "ответим в WhatsApp", kk: "WhatsApp-та жауап береміз" } },
        { icon: "heart", title: { ru: "Забота о каждой семье", kk: "Әр отбасына қамқорлық" }, text: { ru: "с любовью к вам", kk: "сізге деген сүйіспеншілікпен" } },
      ]),
  }),

  notifications: z.object({
    /** Зашифрованный токен бота (encryptSecret) */
    telegramBotToken: z.string().default(""),
    telegramChatIds: z.array(z.string()).default([]),
    events: z
      .object({
        newOrder: z.boolean().default(true),
        newReview: z.boolean().default(true),
        lowStock: z.boolean().default(true),
        contactMessage: z.boolean().default(true),
      })
      .default({ newOrder: true, newReview: true, lowStock: true, contactMessage: true }),
    customerEmails: z
      .object({
        orderCreated: z.boolean().default(true),
        statusChanged: z.boolean().default(true),
      })
      .default({ orderCreated: true, statusChanged: true }),
    /** Письма владельцу (копии уведомлений) */
    adminEmails: z.array(z.string()).default([]),
  }),

  seo: z.object({
    title: localized("Ана мен бала — товары для мам, детей и дома", "Ана мен бала — аналар, балалар мен үйге арналған тауарлар"),
    description: localized(
      "Интернет-магазин «Ана мен бала»: одежда и товары для детей, мам и дома. Доставка по Казахстану, самовывоз в Ганюшкино.",
      "«Ана мен бала» интернет-дүкені: балаларға, аналарға және үйге арналған киім мен тауарлар. Қазақстан бойынша жеткізу.",
    ),
    keywords: localized("детская одежда, товары для мам, сумка в роддом, Ганюшкино", "балалар киімі, аналарға арналған тауарлар"),
    ogImageMediaId: z.string().nullable().default(null),
  }),

  statuses: z.object({
    order: z
      .object({
        NEW: statusLabel("Новый", "Жаңа", "sky"),
        CONFIRMED: statusLabel("Подтверждён", "Расталды", "sage"),
        PACKING: statusLabel("Собирается", "Жиналуда", "amber"),
        SHIPPED: statusLabel("Отправлен", "Жіберілді", "lavender"),
        DELIVERED: statusLabel("Доставлен", "Жеткізілді", "sage"),
        COMPLETED: statusLabel("Завершён", "Аяқталды", "graphite"),
        CANCELLED: statusLabel("Отменён", "Бас тартылды", "powder"),
      })
      .prefault({}),
    payment: z
      .object({
        UNPAID: statusLabel("Не оплачен", "Төленбеген", "gray"),
        PAID: statusLabel("Оплачен", "Төленді", "sage"),
        REFUNDED: statusLabel("Возврат", "Қайтарым", "powder"),
      })
      .prefault({}),
  }),
} as const;

export type SettingsKey = keyof typeof settingsSchemas;
export type Settings<K extends SettingsKey> = z.infer<(typeof settingsSchemas)[K]>;

function parseSetting<K extends SettingsKey>(key: K, raw: unknown): Settings<K> {
  const schema = settingsSchemas[key];
  const result = schema.safeParse(raw ?? {});
  // повреждённое значение не должно ронять сайт — берём значения по умолчанию
  return (result.success ? result.data : schema.parse({})) as Settings<K>;
}

async function loadAll(): Promise<Record<string, unknown>> {
  const rows = await db.setting.findMany();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function getSetting<K extends SettingsKey>(key: K): Promise<Settings<K>> {
  const all = await cached("settings:all", [CacheTags.settings], 5 * 60_000, loadAll);
  return parseSetting(key, all[key]);
}

export async function updateSetting<K extends SettingsKey>(
  key: K,
  value: unknown,
  actor?: { staffUserId: string; ip?: string | null },
): Promise<Settings<K>> {
  const parsed = settingsSchemas[key].parse(value) as Settings<K>;
  const json = parsed as unknown as Prisma.InputJsonValue;
  await db.setting.upsert({ where: { key }, create: { key, value: json }, update: { value: json } });
  invalidateTags(CacheTags.settings);
  if (actor) {
    await audit({ staffUserId: actor.staffUserId, action: "settings.update", entityType: "setting", entityId: key, summary: `Изменены настройки: ${key}`, ip: actor.ip });
  }
  return parsed;
}
