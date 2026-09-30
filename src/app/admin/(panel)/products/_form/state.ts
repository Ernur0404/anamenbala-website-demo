import { internalEan13 } from "@/lib/barcode";
import { skuPart, slugify } from "@/lib/slug";
import { toStoreDateKey, addDays } from "@/lib/dates";

export type ProductStatusValue = "DRAFT" | "PUBLISHED" | "HIDDEN";

export type VariantState = {
  key: string;
  id: string | null;
  optionValueIds: string[];
  sku: string;
  barcode: string;
  price: string;
  costPrice: string;
  stock: string;
  isActive: boolean;
  /** Вариант есть в заказах — удалить нельзя, только выключить */
  hasOrders: boolean;
};

export type MediaState = { mediaId: string; url: string | null; colorValueId: string | null };

export type SpecState = { key: string; labelRu: string; labelKk: string; valueRu: string; valueKk: string };

export type ProductFormState = {
  id: string | null;
  status: ProductStatusValue;
  nameRu: string;
  nameKk: string;
  subtitleRu: string;
  subtitleKk: string;
  slug: string;
  brandId: string;
  descriptionRu: string;
  descriptionKk: string;
  price: string;
  salePrice: string;
  saleStartsAt: string;
  saleEndsAt: string;
  costPrice: string;
  allowBackorder: boolean;
  backorderNoteRu: string;
  backorderNoteKk: string;
  videoMediaId: string | null;
  videoFileUrl: string | null;
  videoUrl: string;
  sizeChartId: string;
  seoTitleRu: string;
  seoTitleKk: string;
  seoDescriptionRu: string;
  seoDescriptionKk: string;
  categoryIds: string[];
  primaryCategoryId: string;
  badgeIds: string[];
  attributeValueIds: string[];
  specs: SpecState[];
  hasVariants: boolean;
  optionAttributeIds: string[];
  /** Отмеченные значения по каждой оси */
  axisValues: Record<string, string[]>;
  variants: VariantState[];
  skuBase: string;
  media: MediaState[];
};

let keySeq = 0;
export const newKey = (prefix = "k") => `${prefix}-${Date.now().toString(36)}-${(keySeq++).toString(36)}`;

export function emptyProductState(): ProductFormState {
  return {
    id: null,
    status: "DRAFT",
    nameRu: "",
    nameKk: "",
    subtitleRu: "",
    subtitleKk: "",
    slug: "",
    brandId: "",
    descriptionRu: "",
    descriptionKk: "",
    price: "",
    salePrice: "",
    saleStartsAt: "",
    saleEndsAt: "",
    costPrice: "",
    allowBackorder: false,
    backorderNoteRu: "",
    backorderNoteKk: "",
    videoMediaId: null,
    videoFileUrl: null,
    videoUrl: "",
    sizeChartId: "",
    seoTitleRu: "",
    seoTitleKk: "",
    seoDescriptionRu: "",
    seoDescriptionKk: "",
    categoryIds: [],
    primaryCategoryId: "",
    badgeIds: [],
    attributeValueIds: [],
    specs: [],
    hasVariants: false,
    optionAttributeIds: [],
    axisValues: {},
    variants: [{ key: newKey("v"), id: null, optionValueIds: [], sku: "", barcode: internalEan13(), price: "", costPrice: "", stock: "0", isActive: true, hasOrders: false }],
    skuBase: "",
    media: [],
  };
}

/** Даты акции хранятся как [начало дня; начало следующего дня) — в форме показываем включительно */
export function saleDateKeys(startsAt: Date | null, endsAt: Date | null) {
  return { start: startsAt ? toStoreDateKey(startsAt) : "", end: endsAt ? toStoreDateKey(addDays(endsAt, -1)) : "" };
}

export function defaultSkuBase(nameRu: string): string {
  const words = slugify(nameRu).split("-").filter(Boolean).slice(0, 2);
  return words.length ? words.join("-").toUpperCase().slice(0, 16) : "";
}

export type ValueLookup = Map<string, { id: string; attributeId: string; slug: string; valueRu: string; colorHex: string | null }>;

export function variantSku(base: string, optionValueIds: string[], values: ValueLookup): string {
  const parts = optionValueIds.map((id) => {
    const v = values.get(id);
    return v ? skuPart(v.slug || v.valueRu, 6) : "X";
  });
  return [base || "SKU", ...parts].join("-").toUpperCase().slice(0, 64);
}

/** Пересобрать таблицу вариантов по отмеченным значениям: существующие сохраняются, новые добавляются */
export function rebuildVariants(state: ProductFormState, values: ValueLookup): VariantState[] {
  const axes = state.optionAttributeIds;
  const lists = axes.map((a) => state.axisValues[a] ?? []);
  if (!axes.length || lists.some((l) => l.length === 0)) return [];
  const combos: string[][] = lists.reduce<string[][]>((acc, list) => acc.flatMap((prefix) => list.map((v) => [...prefix, v])), [[]]);
  const byCombo = new Map(state.variants.map((v) => [v.optionValueIds.join("|"), v]));
  return combos.map((combo) => {
    const existing = byCombo.get(combo.join("|"));
    if (existing) return existing;
    return {
      key: newKey("v"),
      id: null,
      optionValueIds: combo,
      sku: variantSku(state.skuBase || defaultSkuBase(state.nameRu), combo, values),
      barcode: internalEan13(),
      price: "",
      costPrice: "",
      stock: "0",
      isActive: true,
      hasOrders: false,
    };
  });
}

const num = (v: string) => {
  const digits = v.replace(/[^\d]/g, "");
  return digits ? Number.parseInt(digits, 10) : null;
};

/** Состояние формы → данные для server action */
export function toPayload(state: ProductFormState, status: ProductStatusValue) {
  const variants = state.hasVariants ? state.variants : state.variants.slice(0, 1).map((v) => ({ ...v, optionValueIds: [] }));
  return {
    id: state.id,
    status,
    nameRu: state.nameRu,
    nameKk: state.nameKk,
    subtitleRu: state.subtitleRu,
    subtitleKk: state.subtitleKk,
    slug: state.slug,
    brandId: state.brandId || null,
    descriptionRu: state.descriptionRu,
    descriptionKk: state.descriptionKk,
    price: num(state.price) ?? 0,
    salePrice: num(state.salePrice),
    saleStartsAt: state.saleStartsAt || null,
    saleEndsAt: state.saleEndsAt || null,
    costPrice: num(state.costPrice),
    allowBackorder: state.allowBackorder,
    backorderNoteRu: state.backorderNoteRu,
    backorderNoteKk: state.backorderNoteKk,
    videoMediaId: state.videoMediaId,
    videoUrl: state.videoMediaId ? "" : state.videoUrl.trim(),
    sizeChartId: state.sizeChartId || null,
    seoTitleRu: state.seoTitleRu,
    seoTitleKk: state.seoTitleKk,
    seoDescriptionRu: state.seoDescriptionRu,
    seoDescriptionKk: state.seoDescriptionKk,
    categoryIds: state.categoryIds,
    primaryCategoryId: state.primaryCategoryId || null,
    badgeIds: state.badgeIds,
    attributeValueIds: state.attributeValueIds,
    specs: state.specs.filter((s) => s.labelRu.trim() && s.valueRu.trim()).map(({ key: _key, ...s }) => s),
    optionAttributeIds: state.hasVariants ? state.optionAttributeIds : [],
    variants: variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      barcode: v.barcode,
      price: num(v.price),
      costPrice: num(v.costPrice),
      stock: num(v.stock) ?? 0,
      isActive: v.isActive,
      optionValueIds: v.optionValueIds,
    })),
    media: state.media.map((m) => ({ mediaId: m.mediaId, colorValueId: m.colorValueId })),
  };
}
