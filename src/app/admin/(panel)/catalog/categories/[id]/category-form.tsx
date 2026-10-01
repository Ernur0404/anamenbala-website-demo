"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { DynamicIcon, ICON_KEYS } from "@/components/ui/icons";
import { Panel } from "@/components/admin/ui";
import { ImageField } from "@/components/admin/media";
import { ConfirmButton } from "@/components/admin/controls";
import { useAdminAction } from "@/components/admin/use-action";
import { deleteCategoryAction, saveCategoryAction } from "@/server/actions/admin/catalog";
import { slugify } from "@/lib/slug";
import { cn } from "@/lib/utils";

type Img = { id: string; url: string | null } | null;

export type CategoryFormData = {
  id: string | null;
  parentId: string;
  nameRu: string;
  nameKk: string;
  slug: string;
  descriptionRu: string;
  descriptionKk: string;
  heroTitleRu: string;
  heroTitleKk: string;
  heroTextRu: string;
  heroTextKk: string;
  heroScriptRu: string;
  heroScriptKk: string;
  heroImage: Img;
  heroMobileImage: Img;
  tileImage: Img;
  icon: string;
  sizeChartId: string;
  isVisible: boolean;
  showInMenu: boolean;
  seoTitleRu: string;
  seoTitleKk: string;
  seoDescriptionRu: string;
  seoDescriptionKk: string;
  attributes: { attributeId: string; isFilter: boolean }[];
  hasChildren: boolean;
  products: number;
};

type TextKey = {
  [K in keyof CategoryFormData]: CategoryFormData[K] extends string ? K : never;
}[keyof CategoryFormData];

export function CategoryForm({
  initial,
  roots,
  attributes,
  sizeCharts,
}: {
  initial: CategoryFormData;
  roots: { id: string; name: string; attributeIds: string[] }[];
  attributes: { id: string; name: string; code: string; isVariantAxis: boolean; values: number }[];
  sizeCharts: { id: string; nameRu: string }[];
}) {
  const t = useTranslations("admin.catalog");
  const tc = useTranslations("admin.common");
  const router = useRouter();
  const { pending, execute, fieldError } = useAdminAction();
  const [form, setForm] = useState(initial);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.id));
  const set = (key: TextKey) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const text = (key: TextKey, label: string, opts: { area?: boolean; max?: number } = {}) => (
    <Field label={label} error={fieldError(key)}>
      {opts.area ? <Textarea rows={3} value={form[key]} onChange={set(key)} maxLength={opts.max} /> : <Input value={form[key]} onChange={set(key)} maxLength={opts.max} />}
    </Field>
  );

  const inherited = new Set(roots.find((r) => r.id === form.parentId)?.attributeIds ?? []);
  const assigned = new Map(form.attributes.map((a) => [a.attributeId, a]));
  const moveAttr = (index: number, dir: -1 | 1) =>
    setForm((f) => {
      const list = [...f.attributes];
      const target = index + dir;
      if (target < 0 || target >= list.length) return f;
      [list[index], list[target]] = [list[target], list[index]];
      return { ...f, attributes: list };
    });

  const save = () =>
    execute(
      () =>
        saveCategoryAction({
          ...form,
          parentId: form.parentId || null,
          heroImageId: form.heroImage?.id ?? null,
          heroMobileImageId: form.heroMobileImage?.id ?? null,
          tileImageId: form.tileImage?.id ?? null,
          sizeChartId: form.sizeChartId || null,
          icon: form.icon || null,
        }),
      {
        success: t("saved"),
        onSuccess: (d) => {
          if (!form.id) router.replace(`/admin/catalog/categories/${d.id}`);
        },
      },
    );

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-5">
        <Panel title={t("sections.main")}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t("fields.nameRu")} required error={fieldError("nameRu")}>
              <Input
                value={form.nameRu}
                maxLength={100}
                onChange={(e) => {
                  const nameRu = e.target.value;
                  setForm((f) => ({ ...f, nameRu, ...(slugTouched ? {} : { slug: slugify(nameRu) }) }));
                }}
              />
            </Field>
            {text("nameKk", t("fields.nameKk"), { max: 100 })}
            <Field label={tc("slug")} hint={tc("slugHint")} error={fieldError("slug")}>
              <Input
                value={form.slug}
                maxLength={100}
                onChange={(e) => {
                  setSlugTouched(true);
                  setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }));
                }}
              />
            </Field>
            <Field label={t("fields.parent")} error={fieldError("parentId")}>
              <Select value={form.parentId} onChange={set("parentId")} disabled={form.hasChildren}>
                <option value="">{t("fields.noParent")}</option>
                {roots.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </Field>
            {text("descriptionRu", t("fields.descriptionRu"), { area: true, max: 2000 })}
            {text("descriptionKk", t("fields.descriptionKk"), { area: true, max: 2000 })}
          </div>
        </Panel>

        <Panel title={t("sections.hero")}>
          <div className="grid gap-4 md:grid-cols-2">
            {text("heroTitleRu", t("fields.heroTitleRu"), { max: 200 })}
            {text("heroTitleKk", t("fields.heroTitleKk"), { max: 200 })}
            {text("heroTextRu", t("fields.heroTextRu"), { area: true, max: 400 })}
            {text("heroTextKk", t("fields.heroTextKk"), { area: true, max: 400 })}
            {text("heroScriptRu", t("fields.heroScriptRu"), { max: 120 })}
            {text("heroScriptKk", t("fields.heroScriptKk"), { max: 120 })}
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-1.5 text-[13px] font-medium text-ink-700">{t("fields.heroImage")}</p>
              <ImageField value={form.heroImage} onChange={(heroImage) => setForm((f) => ({ ...f, heroImage }))} aspect="aspect-[16/6]" />
            </div>
            <div>
              <p className="mb-1.5 text-[13px] font-medium text-ink-700">{t("fields.heroMobileImage")}</p>
              <ImageField value={form.heroMobileImage} onChange={(heroMobileImage) => setForm((f) => ({ ...f, heroMobileImage }))} aspect="aspect-[16/6]" hint={tc("mobileImageHint")} />
            </div>
          </div>
        </Panel>

        <Panel title={t("sections.attributes")} subtitle={t("fields.attributesHint")}>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {form.attributes.map((a, i) => {
              const attr = attributes.find((x) => x.id === a.attributeId);
              if (!attr) return null;
              return (
                <li key={a.attributeId} className="flex flex-wrap items-center gap-3 px-3.5 py-2.5">
                  <Checkbox checked onChange={() => setForm((f) => ({ ...f, attributes: f.attributes.filter((x) => x.attributeId !== a.attributeId) }))} label={<span className="font-semibold text-graphite">{attr.name}</span>} />
                  <span className="text-[12px] text-ink-400">{attr.code}</span>
                  <label className="ml-auto flex items-center gap-2 text-[12.5px] text-ink-600">
                    <input
                      type="checkbox"
                      checked={a.isFilter}
                      onChange={(e) => setForm((f) => ({ ...f, attributes: f.attributes.map((x) => (x.attributeId === a.attributeId ? { ...x, isFilter: e.target.checked } : x)) }))}
                      className="size-4 accent-[#587e63]"
                    />
                    {t("fields.isFilter")}
                  </label>
                  <button type="button" onClick={() => moveAttr(i, -1)} disabled={i === 0} className="grid size-7 place-items-center rounded-md text-ink-500 hover:bg-cream disabled:opacity-30" aria-label={t("moveUp")}>
                    <ArrowUp className="size-3.5" />
                  </button>
                  <button type="button" onClick={() => moveAttr(i, 1)} disabled={i === form.attributes.length - 1} className="grid size-7 place-items-center rounded-md text-ink-500 hover:bg-cream disabled:opacity-30" aria-label={t("moveDown")}>
                    <ArrowDown className="size-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            {attributes
              .filter((a) => !assigned.has(a.id))
              .map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, attributes: [...f.attributes, { attributeId: a.id, isFilter: true }] }))}
                  className={cn("inline-flex h-8 items-center gap-1.5 rounded-full border border-dashed px-3 text-[12.5px] font-semibold transition-colors", inherited.has(a.id) ? "border-sage-300 bg-sage-50 text-sage-800" : "border-line-strong text-ink-600 hover:border-sage-400")}
                  title={inherited.has(a.id) ? "↑" : undefined}
                >
                  + {a.name}
                </button>
              ))}
          </div>
        </Panel>

        <Panel title={t("sections.seo")}>
          <div className="grid gap-4 md:grid-cols-2">
            {text("seoTitleRu", `${tc("seoTitle")} (RU)`, { max: 200 })}
            {text("seoTitleKk", `${tc("seoTitle")} (KZ)`, { max: 200 })}
            {text("seoDescriptionRu", `${tc("seoDescription")} (RU)`, { area: true, max: 400 })}
            {text("seoDescriptionKk", `${tc("seoDescription")} (KZ)`, { area: true, max: 400 })}
          </div>
        </Panel>
      </div>

      <div className="space-y-5 xl:sticky xl:top-24">
        <Panel>
          <div className="space-y-3">
            <Checkbox label={t("fields.isVisible")} checked={form.isVisible} onChange={(e) => setForm((f) => ({ ...f, isVisible: e.target.checked }))} />
            <Checkbox label={t("fields.showInMenu")} checked={form.showInMenu} onChange={(e) => setForm((f) => ({ ...f, showInMenu: e.target.checked }))} />
          </div>
          <Button block className="mt-5" loading={pending} disabled={!form.nameRu.trim()} onClick={() => void save()}>
            {tc("save")}
          </Button>
          {form.id && (
            <ConfirmButton
              title={t("deleteCategory")}
              text={t("deleteCategoryText")}
              confirmLabel={tc("delete")}
              variant="ghost"
              className="mt-2 w-full text-powder-800"
              onConfirm={() =>
                execute(() => deleteCategoryAction({ id: form.id! }), {
                  success: t("deleted"),
                  onSuccess: () => router.push("/admin/catalog"),
                  errorMessage: (f) => (f.details?.reason === "categoryHasProducts" ? t("categoryHasProducts") : undefined),
                })
              }
            >
              {t("deleteCategory")}
            </ConfirmButton>
          )}
        </Panel>

        <Panel title={t("fields.tileImage")} subtitle={t("fields.tileHint")}>
          <ImageField value={form.tileImage} onChange={(tileImage) => setForm((f) => ({ ...f, tileImage }))} aspect="aspect-[6/5]" />
        </Panel>

        <Panel title={t("fields.icon")}>
          <div className="grid grid-cols-6 gap-1.5">
            {ICON_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setForm((f) => ({ ...f, icon: f.icon === key ? "" : key }))}
                aria-pressed={form.icon === key}
                title={key}
                className={cn("grid aspect-square place-items-center rounded-lg border transition-colors", form.icon === key ? "border-sage-700 bg-sage-700 text-white" : "border-line text-ink-600 hover:border-sage-400")}
              >
                <DynamicIcon name={key} size={18} />
              </button>
            ))}
          </div>
        </Panel>

        <Panel title={t("fields.sizeChart")}>
          <Select value={form.sizeChartId} onChange={set("sizeChartId")} aria-label={t("fields.sizeChart")}>
            <option value="">{t("fields.noSizeChart")}</option>
            {sizeCharts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameRu}
              </option>
            ))}
          </Select>
        </Panel>
      </div>
    </div>
  );
}
