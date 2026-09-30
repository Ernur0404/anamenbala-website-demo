"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Plus, Settings2, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Dialog, DialogContent, Switch } from "@/components/ui/primitives";
import { ConfirmButton } from "@/components/admin/controls";
import { ProductMultiPicker, type PickedProduct } from "@/components/admin/product-picker";
import { useAdminAction } from "@/components/admin/use-action";
import { addProductsSectionAction, deleteHomeSectionAction, moveHomeSectionAction, saveHomeSectionAction, toggleHomeSectionAction } from "@/server/actions/admin/content";
import { cn } from "@/lib/utils";

type SectionType = "CATEGORY_TILES" | "PRODUCTS" | "PROMO_BANNER" | "ADVANTAGES" | "REVIEWS" | "INSTAGRAM" | "RECENTLY_VIEWED";
export type SectionRow = {
  id: string;
  type: SectionType;
  titleRu: string;
  titleKk: string;
  isActive: boolean;
  first: boolean;
  last: boolean;
  config: { source: string; categorySlug: string; limit: number; products: PickedProduct[] };
};

const TITLED: SectionType[] = ["PRODUCTS", "REVIEWS", "INSTAGRAM", "RECENTLY_VIEWED"];
const small = "grid size-8 place-items-center rounded-md border border-line bg-white text-ink-500 hover:border-sage-400 hover:text-sage-700 disabled:opacity-30";

export function HomeSections({ rows, categories }: { rows: SectionRow[]; categories: { slug: string; name: string; nested: boolean }[] }) {
  const t = useTranslations("admin.content");
  const tc = useTranslations("admin.common");
  const { pending, execute } = useAdminAction();
  const [edit, setEdit] = useState<SectionRow | null>(null);

  return (
    <>
      <ul className="divide-y divide-line border-t border-line">
        {rows.map((s) => (
          <li key={s.id} className={cn("flex flex-wrap items-center gap-3 px-5 py-3 sm:px-6", !s.isActive && "bg-cream/50")}>
            <div className="min-w-48 flex-1">
              <p className={cn("font-semibold", s.isActive ? "text-graphite" : "text-ink-500")}>{s.titleRu || t(`sections.types.${s.type}`)}</p>
              <p className="text-[12px] text-ink-500">
                {t(`sections.types.${s.type}`)}
                {s.type === "PRODUCTS" && ` · ${t(`sections.sources.${s.config.source}`)} · ${s.config.limit}`}
              </p>
            </div>
            <button type="button" className={small} disabled={s.first || pending} onClick={() => void execute(() => moveHomeSectionAction({ id: s.id, direction: "up" }), { success: false })} aria-label={t("moveUp")}>
              <ArrowUp className="size-3.5" />
            </button>
            <button type="button" className={small} disabled={s.last || pending} onClick={() => void execute(() => moveHomeSectionAction({ id: s.id, direction: "down" }), { success: false })} aria-label={t("moveDown")}>
              <ArrowDown className="size-3.5" />
            </button>
            <Switch checked={s.isActive} disabled={pending} onCheckedChange={(isActive) => void execute(() => toggleHomeSectionAction({ id: s.id, isActive }), { success: t("saved") })} aria-label={t("active")} />
            {TITLED.includes(s.type) && (
              <Button size="sm" variant="secondary" onClick={() => setEdit(s)}>
                <Settings2 />
                {t("sections.edit")}
              </Button>
            )}
            {s.type === "PRODUCTS" && (
              <ConfirmButton title={t("sections.deleteSection")} confirmLabel={tc("delete")} size="iconSm" variant="ghost" className="border border-line bg-white text-ink-600 hover:bg-powder-50 hover:text-powder-800" aria-label={t("sections.deleteSection")} onConfirm={() => execute(() => deleteHomeSectionAction({ id: s.id }), { success: t("deleted") })}>
                <Trash className="size-3.5" />
              </ConfirmButton>
            )}
          </li>
        ))}
      </ul>
      <div className="border-t border-line px-5 py-4 sm:px-6">
        <Button size="sm" variant="soft" loading={pending} onClick={() => void execute(() => addProductsSectionAction({}), { success: t("saved") })}>
          <Plus />
          {t("sections.addProducts")}
        </Button>
      </div>

      <Dialog open={Boolean(edit)} onOpenChange={(v) => !v && setEdit(null)}>
        {edit && (
          <DialogContent title={edit.titleRu || t(`sections.types.${edit.type}`)} size="md">
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void execute(
                  () =>
                    saveHomeSectionAction({
                      id: edit.id,
                      titleRu: edit.titleRu,
                      titleKk: edit.titleKk,
                      isActive: edit.isActive,
                      config:
                        edit.type === "PRODUCTS"
                          ? { source: edit.config.source as "popular", categorySlug: edit.config.categorySlug || null, productIds: edit.config.products.map((p) => p.id), limit: edit.config.limit }
                          : { limit: edit.config.limit },
                    }),
                  { success: t("saved"), onSuccess: () => setEdit(null) },
                );
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("sections.titleRu")}>
                  <Input value={edit.titleRu} onChange={(e) => setEdit({ ...edit, titleRu: e.target.value })} maxLength={120} />
                </Field>
                <Field label={t("sections.titleKk")}>
                  <Input value={edit.titleKk} onChange={(e) => setEdit({ ...edit, titleKk: e.target.value })} maxLength={120} />
                </Field>
              </div>
              {edit.type === "PRODUCTS" && (
                <>
                  <Field label={t("sections.source")}>
                    <Select value={edit.config.source} onChange={(e) => setEdit({ ...edit, config: { ...edit.config, source: e.target.value } })}>
                      {(["popular", "new", "sale", "category", "manual"] as const).map((s) => (
                        <option key={s} value={s}>
                          {t(`sections.sources.${s}`)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  {edit.config.source === "category" && (
                    <Field label={t("sections.category")}>
                      <Select value={edit.config.categorySlug} onChange={(e) => setEdit({ ...edit, config: { ...edit.config, categorySlug: e.target.value } })}>
                        <option value="">—</option>
                        {categories.map((c) => (
                          <option key={c.slug} value={c.slug}>
                            {c.nested ? `— ${c.name}` : c.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  )}
                  {edit.config.source === "manual" && (
                    <div>
                      <p className="mb-1.5 text-[13px] font-medium text-ink-700">{t("sections.products")}</p>
                      <ProductMultiPicker value={edit.config.products} onChange={(products) => setEdit({ ...edit, config: { ...edit.config, products } })} />
                    </div>
                  )}
                </>
              )}
              {edit.type !== "INSTAGRAM" && (
                <Field label={t("sections.limit")} className="max-w-40">
                  <Input inputMode="numeric" value={edit.config.limit} onChange={(e) => setEdit({ ...edit, config: { ...edit.config, limit: Math.min(24, Number(e.target.value.replace(/\D/g, "")) || 1) } })} />
                </Field>
              )}
              <div className="flex justify-end gap-2.5">
                <Button variant="secondary" onClick={() => setEdit(null)}>
                  {tc("cancel")}
                </Button>
                <Button type="submit" loading={pending}>
                  {tc("save")}
                </Button>
              </div>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
