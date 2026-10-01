"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { StatusPill } from "@/components/ui/display";
import { Panel } from "@/components/admin/ui";
import { RichTextEditor } from "@/components/admin/rich-text";
import { useAdminAction } from "@/components/admin/use-action";
import { saveProductAction } from "@/server/actions/admin/products";
import type { ProductFormOptions } from "@/server/admin/products";
import { slugify } from "@/lib/slug";
import { cn } from "@/lib/utils";
import { toPayload, type ProductFormState, type ProductStatusValue, type ValueLookup } from "./state";
import { MediaSection } from "./media-section";
import { VariantsSection } from "./variants-section";
import { AttributesSection, SpecsSection } from "./attributes-section";
import { BadgePicker, CategoryPicker, PrimaryCategorySelect } from "./categories-section";

type Update = Partial<ProductFormState> | ((s: ProductFormState) => Partial<ProductFormState>);

function LangTabs({ value, onChange, filledKk }: { value: "ru" | "kk"; onChange: (v: "ru" | "kk") => void; filledKk: boolean }) {
  return (
    <div className="inline-flex rounded-full bg-cream-200 p-0.5 text-[12px] font-semibold">
      {(["ru", "kk"] as const).map((l) => (
        <button key={l} type="button" onClick={() => onChange(l)} className={cn("relative rounded-full px-3 py-1 transition-colors", value === l ? "bg-white text-sage-800 shadow-soft" : "text-ink-500 hover:text-graphite")}>
          {l === "ru" ? "RU" : "KZ"}
          {l === "kk" && !filledKk && <span className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-amber-700/70" />}
        </button>
      ))}
    </div>
  );
}

export function ProductForm({ initial, options, finance, publishedLabel }: { initial: ProductFormState; options: ProductFormOptions; finance: boolean; publishedLabel?: string | null }) {
  const t = useTranslations("admin.products");
  const tc = useTranslations("admin.common");
  const router = useRouter();
  const { pending, execute, fieldErrors, fieldError } = useAdminAction();
  const [state, setState] = useState<ProductFormState>(initial);
  const [descLang, setDescLang] = useState<"ru" | "kk">("ru");
  const [status, setStatus] = useState<ProductStatusValue>(initial.status);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.id));

  const update = useCallback((patch: Update) => setState((s) => ({ ...s, ...(typeof patch === "function" ? patch(s) : patch) })), []);
  const dirty = useMemo(() => JSON.stringify(state) !== JSON.stringify(initial) || status !== initial.status, [state, initial, status]);

  useEffect(() => {
    if (!dirty) return;
    const onLeave = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  const values: ValueLookup = useMemo(() => {
    const map: ValueLookup = new Map();
    for (const a of options.attributes) for (const v of a.values) map.set(v.id, { ...v, attributeId: a.id });
    return map;
  }, [options.attributes]);

  const axisAttributes = useMemo(() => options.attributes.filter((a) => a.isVariantAxis), [options.attributes]);

  // характеристики категорий товара (с наследованием от родителя), без осей вариантов
  const filterAttributes = useMemo(() => {
    const byId = new Map(options.categories.map((c) => [c.id, c]));
    const order = new Map<string, number>();
    for (const id of state.categoryIds) {
      let c = byId.get(id);
      while (c) {
        for (const link of c.attributes) if (!order.has(link.attributeId)) order.set(link.attributeId, link.sortOrder);
        c = c.parentId ? byId.get(c.parentId) : undefined;
      }
    }
    const axes = new Set(state.hasVariants ? state.optionAttributeIds : []);
    return options.attributes.filter((a) => order.has(a.id) && !axes.has(a.id)).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  }, [options.categories, options.attributes, state.categoryIds, state.optionAttributeIds, state.hasVariants]);

  // цвета для привязки фото — отмеченные значения оси-цвета
  const colorOptions = useMemo(() => {
    const colorAxis = state.optionAttributeIds.find((id) => {
      const a = options.attributes.find((x) => x.id === id);
      return a && (a.type === "COLOR" || a.display === "SWATCH");
    });
    if (!colorAxis || !state.hasVariants) return [];
    return (state.axisValues[colorAxis] ?? []).map((id) => {
      const v = values.get(id);
      return { id, label: v?.valueRu ?? id, colorHex: v?.colorHex ?? null };
    });
  }, [state.optionAttributeIds, state.axisValues, state.hasVariants, options.attributes, values]);

  const productError = (key: string) => {
    const code = fieldErrors[key];
    if (!code) return undefined;
    if (t.has(`errors.${code}`)) return t(`errors.${code}`, { sku: "", barcode: "" });
    if (code === "duplicateSku") return t("variants.duplicateSku");
    return fieldError(key);
  };

  const save = (nextStatus: ProductStatusValue) => {
    // только значения характеристик, которые относятся к выбранным категориям
    const allowed = new Set(filterAttributes.flatMap((a) => a.values.map((v) => v.id)));
    const payload = toPayload({ ...state, attributeValueIds: state.attributeValueIds.filter((id) => allowed.has(id)) }, nextStatus);
    return execute(() => saveProductAction(payload), {
      success: false,
      onSuccess: (data) => {
        setStatus(nextStatus);
        toast.success(data.created ? t("created") : t("saved"));
        if (data.created) router.replace(`/admin/products/${data.id}`);
      },
      onError: () => window.scrollTo({ top: 0, behavior: "smooth" }),
    });
  };

  const canSave = state.nameRu.trim().length > 0 && state.categoryIds.length > 0 && (state.hasVariants ? state.variants.length > 0 : true);

  const actions = (
    <div className="space-y-2.5">
      {state.id ? (
        <>
          <Field label={t("fields.status")}>
            <Select value={status} onChange={(e) => setStatus(e.target.value as ProductStatusValue)}>
              {(["PUBLISHED", "DRAFT", "HIDDEN"] as const).map((s) => (
                <option key={s} value={s}>
                  {t(`status.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Button block loading={pending} disabled={!canSave} onClick={() => void save(status)}>
            {t("saveChanges")}
          </Button>
        </>
      ) : (
        <>
          <Button block loading={pending} disabled={!canSave} onClick={() => void save("PUBLISHED")}>
            {t("publish")}
          </Button>
          <Button block variant="secondary" disabled={pending || !canSave} onClick={() => void save("DRAFT")}>
            {t("saveDraft")}
          </Button>
        </>
      )}
      {dirty && <p className="text-center text-[12px] font-medium text-amber-700">{tc("unsaved")}</p>}
    </div>
  );

  // на телефоне и планшете — одна строка кнопок в нижней панели
  const mobileActions = (
    <div>
      {dirty && <p className="mb-2 text-center text-[12px] font-medium text-amber-700">{tc("unsaved")}</p>}
      <div className="flex items-stretch gap-2.5">
        {state.id ? (
          <>
            <Select value={status} onChange={(e) => setStatus(e.target.value as ProductStatusValue)} aria-label={t("fields.status")} wrapperClassName="w-[42%] max-w-48 shrink-0">
              {(["PUBLISHED", "DRAFT", "HIDDEN"] as const).map((s) => (
                <option key={s} value={s}>
                  {t(`status.${s}`)}
                </option>
              ))}
            </Select>
            <Button className="min-w-0 flex-1 whitespace-normal leading-tight" loading={pending} disabled={!canSave} onClick={() => void save(status)}>
              {t("saveChanges")}
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" className="min-w-0 flex-1 whitespace-normal leading-tight" disabled={pending || !canSave} onClick={() => void save("DRAFT")}>
              {t("saveDraft")}
            </Button>
            <Button className="min-w-0 flex-1 whitespace-normal leading-tight" loading={pending} disabled={!canSave} onClick={() => void save("PUBLISHED")}>
              {t("publish")}
            </Button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 items-start gap-5 pb-24 xl:grid-cols-[minmax(0,1fr)_340px] xl:pb-0">
      <div className="min-w-0 space-y-5">
        {/* основное */}
        <Panel title={t("sections.main")}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t("fields.nameRu")} required error={productError("nameRu")}>
              <Input
                value={state.nameRu}
                maxLength={200}
                onChange={(e) => {
                  const nameRu = e.target.value;
                  update({ nameRu, ...(slugTouched ? {} : { slug: slugify(nameRu) }) });
                }}
              />
            </Field>
            <Field label={t("fields.nameKk")} hint={tc("kkHint")}>
              <Input value={state.nameKk} maxLength={200} onChange={(e) => update({ nameKk: e.target.value })} />
            </Field>
            <Field label={t("fields.subtitleRu")} hint={t("fields.subtitleHint")}>
              <Input value={state.subtitleRu} maxLength={120} onChange={(e) => update({ subtitleRu: e.target.value })} />
            </Field>
            <Field label={t("fields.subtitleKk")}>
              <Input value={state.subtitleKk} maxLength={120} onChange={(e) => update({ subtitleKk: e.target.value })} />
            </Field>
            <Field label={t("fields.slug")} hint={tc("slugHint")} error={productError("slug")}>
              <div className="flex items-center rounded-md border border-line-strong bg-white focus-within:border-sage-500 focus-within:ring-3 focus-within:ring-sage-500/15">
                <span className="pl-3 text-[13px] whitespace-nowrap text-ink-400">/product/</span>
                <input
                  value={state.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    update({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") });
                  }}
                  className="h-11 w-full min-w-0 bg-transparent pr-3 text-[14px] outline-none"
                  maxLength={100}
                  aria-label={t("fields.slug")}
                />
              </div>
            </Field>
            <Field label={t("fields.brand")}>
              <Select value={state.brandId} onChange={(e) => update({ brandId: e.target.value })}>
                <option value="">{t("fields.noBrand")}</option>
                {options.brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Panel>

        {/* фото */}
        <Panel title={t("sections.media")}>
          <MediaSection
            media={state.media}
            onMedia={(media) => update({ media })}
            colors={colorOptions}
            video={{ mediaId: state.videoMediaId, fileUrl: state.videoFileUrl, url: state.videoUrl }}
            onVideo={(v) => update({ videoMediaId: v.mediaId, videoFileUrl: v.fileUrl, videoUrl: v.url })}
          />
        </Panel>

        {/* описание */}
        <Panel title={t("sections.description")} subtitle={t("descriptionHint")} action={<LangTabs value={descLang} onChange={setDescLang} filledKk={Boolean(state.descriptionKk)} />}>
          {descLang === "ru" ? (
            <RichTextEditor key="ru" value={state.descriptionRu} onChange={(descriptionRu) => update({ descriptionRu })} />
          ) : (
            <RichTextEditor key="kk" value={state.descriptionKk} onChange={(descriptionKk) => update({ descriptionKk })} />
          )}
        </Panel>

        {/* цена */}
        <Panel title={t("sections.price")}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={t("fields.price")} required error={productError("price")}>
              <Input inputMode="numeric" value={state.price} onChange={(e) => update({ price: e.target.value.replace(/\D/g, "") })} />
            </Field>
            <Field label={t("fields.salePrice")}>
              <Input inputMode="numeric" value={state.salePrice} onChange={(e) => update({ salePrice: e.target.value.replace(/\D/g, "") })} />
            </Field>
            <Field label={t("fields.saleStartsAt")}>
              <Input type="date" value={state.saleStartsAt} disabled={!state.salePrice} onChange={(e) => update({ saleStartsAt: e.target.value })} />
            </Field>
            <Field label={t("fields.saleEndsAt")}>
              <Input type="date" value={state.saleEndsAt} min={state.saleStartsAt || undefined} disabled={!state.salePrice} onChange={(e) => update({ saleEndsAt: e.target.value })} />
            </Field>
          </div>
          <p className="mt-3 text-[12px] text-ink-500">{t("fields.saleHint")}</p>
          {finance && state.hasVariants && (
            <div className="mt-4 max-w-xs">
              <Field label={t("fields.costPrice")} hint={t("fields.costHint")}>
                <Input inputMode="numeric" value={state.costPrice} onChange={(e) => update({ costPrice: e.target.value.replace(/\D/g, "") })} />
              </Field>
            </div>
          )}
        </Panel>

        {/* варианты */}
        <Panel title={t("sections.variants")}>
          <VariantsSection state={state} update={update} axisAttributes={axisAttributes} values={values} finance={finance} fieldError={productError} />
        </Panel>

        {/* характеристики */}
        <Panel title={t("sections.attributes")}>
          <AttributesSection attributes={filterAttributes} selected={state.attributeValueIds} onChange={(attributeValueIds) => update({ attributeValueIds })} />
        </Panel>
        <Panel title={t("sections.specs")}>
          <SpecsSection specs={state.specs} onChange={(specs) => update({ specs })} />
        </Panel>

        {/* SEO */}
        <Panel title={t("sections.seo")} subtitle={t("seoHint")}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={`${tc("seoTitle")} (RU)`}>
              <Input value={state.seoTitleRu} maxLength={200} onChange={(e) => update({ seoTitleRu: e.target.value })} placeholder={state.nameRu} />
            </Field>
            <Field label={`${tc("seoTitle")} (KZ)`}>
              <Input value={state.seoTitleKk} maxLength={200} onChange={(e) => update({ seoTitleKk: e.target.value })} placeholder={state.nameKk} />
            </Field>
            <Field label={`${tc("seoDescription")} (RU)`}>
              <Textarea rows={3} value={state.seoDescriptionRu} maxLength={400} onChange={(e) => update({ seoDescriptionRu: e.target.value })} />
            </Field>
            <Field label={`${tc("seoDescription")} (KZ)`}>
              <Textarea rows={3} value={state.seoDescriptionKk} maxLength={400} onChange={(e) => update({ seoDescriptionKk: e.target.value })} />
            </Field>
          </div>
        </Panel>
      </div>

      {/* боковая колонка */}
      <div className="space-y-5 xl:sticky xl:top-24">
        <Panel title={t("sections.visibility")} action={state.id ? <StatusPill tone={initial.status === "PUBLISHED" ? "sage" : initial.status === "HIDDEN" ? "beige" : "gray"}>{t(`status.${initial.status}`)}</StatusPill> : null}>
          <div className="hidden xl:block">{actions}</div>
          <p className="mt-3 text-[12px] text-ink-500 xl:mt-3">{publishedLabel ?? t("notPublished")}</p>
          {state.id && initial.status === "PUBLISHED" && (
            <a href={`/product/${initial.slug}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-sage-700 hover:underline">
              <ExternalLink className="size-3.5" />
              {t("openOnSite")}
            </a>
          )}
        </Panel>

        <Panel title={t("sections.categories")}>
          <CategoryPicker categories={options.categories} selected={state.categoryIds} onChange={(categoryIds) => update({ categoryIds })} error={productError("categoryIds")} />
          <PrimaryCategorySelect categories={options.categories} selected={state.categoryIds} value={state.primaryCategoryId} onChange={(primaryCategoryId) => update({ primaryCategoryId })} />
        </Panel>

        {options.badges.length > 0 && (
          <Panel title={t("sections.badges")}>
            <BadgePicker badges={options.badges} selected={state.badgeIds} onChange={(badgeIds) => update({ badgeIds })} />
          </Panel>
        )}

        <Panel title={t("sections.backorder")}>
          <Checkbox label={t("fields.allowBackorder")} checked={state.allowBackorder} onChange={(e) => update({ allowBackorder: e.target.checked })} />
          {state.allowBackorder && (
            <div className="mt-3 space-y-3">
              <Field label={t("fields.backorderNoteRu")}>
                <Input value={state.backorderNoteRu} maxLength={200} placeholder={t("fields.backorderPlaceholder")} onChange={(e) => update({ backorderNoteRu: e.target.value })} />
              </Field>
              <Field label={t("fields.backorderNoteKk")}>
                <Input value={state.backorderNoteKk} maxLength={200} onChange={(e) => update({ backorderNoteKk: e.target.value })} />
              </Field>
            </div>
          )}
        </Panel>

        {options.sizeCharts.length > 0 && (
          <Panel title={t("sections.sizeChart")}>
            <Select value={state.sizeChartId} onChange={(e) => update({ sizeChartId: e.target.value })} aria-label={t("fields.sizeChart")}>
              <option value="">{t("fields.sizeChartInherit")}</option>
              {options.sizeCharts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameRu}
                </option>
              ))}
            </Select>
          </Panel>
        )}
      </div>

      {/* кнопки сохранения на телефоне и планшете */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 py-3 shadow-pop backdrop-blur xl:hidden">
        <div className="mx-auto max-w-3xl">{mobileActions}</div>
      </div>
    </div>
  );
}
