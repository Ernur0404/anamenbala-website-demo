"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Plus, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { Dialog, DialogContent } from "@/components/ui/primitives";
import { StatusPill } from "@/components/ui/display";
import { Thumb } from "@/components/admin/ui";
import { ImageField } from "@/components/admin/media";
import { ConfirmButton } from "@/components/admin/controls";
import { useAdminAction } from "@/components/admin/use-action";
import { deleteBrandAction, saveBrandAction } from "@/server/actions/admin/catalog";
import { SortButtons } from "../sort-buttons";

type Brand = { id: string; name: string; slug: string; isVisible: boolean; logo: { id: string; url: string | null } | null; products: number };
type Draft = { id: string | null; name: string; slug: string; isVisible: boolean; logo: { id: string; url: string | null } | null };

export function BrandsList({ brands }: { brands: Brand[] }) {
  const t = useTranslations("admin.catalog");
  const tc = useTranslations("admin.common");
  const { pending, execute } = useAdminAction();
  const [draft, setDraft] = useState<Draft | null>(null);

  return (
    <>
      <div className="flex justify-end px-5 pt-5 pb-3 sm:px-6">
        <Button size="sm" onClick={() => setDraft({ id: null, name: "", slug: "", isVisible: true, logo: null })}>
          <Plus />
          {t("brand.add")}
        </Button>
      </div>
      <ul className="divide-y divide-line border-t border-line">
        {brands.length === 0 && <li className="px-6 py-10 text-center text-sm text-ink-500">{tc("emptyList")}</li>}
        {brands.map((b, i) => (
          <li key={b.id} className="flex flex-wrap items-center gap-3 px-5 py-3 sm:px-6">
            <Thumb src={b.logo?.url} size={40} className="rounded-full" />
            <div className="min-w-40 flex-1">
              <p className="font-semibold text-graphite">{b.name}</p>
              <p className="text-[12px] text-ink-500">
                /{b.slug} · {t("brand.products")}: {b.products}
              </p>
            </div>
            {!b.isVisible && <StatusPill tone="beige">{t("hiddenBadge")}</StatusPill>}
            <SortButtons kind="brand" id={b.id} first={i === 0} last={i === brands.length - 1} />
            <button type="button" onClick={() => setDraft({ id: b.id, name: b.name, slug: b.slug, isVisible: b.isVisible, logo: b.logo })} className="grid size-8 place-items-center rounded-md border border-line bg-white text-ink-600 hover:border-sage-400 hover:text-sage-700" aria-label={tc("edit")}>
              <Pencil className="size-3.5" />
            </button>
            <ConfirmButton title={`${tc("delete")} «${b.name}»?`} text={t("brand.deleteText")} confirmLabel={tc("delete")} size="iconSm" variant="ghost" className="border border-line bg-white text-ink-600 hover:bg-powder-50 hover:text-powder-800" onConfirm={() => execute(() => deleteBrandAction({ id: b.id }), { success: t("deleted") })} aria-label={tc("delete")}>
              <Trash className="size-3.5" />
            </ConfirmButton>
          </li>
        ))}
      </ul>

      <Dialog open={Boolean(draft)} onOpenChange={(v) => !v && setDraft(null)}>
        {draft && (
          <DialogContent title={draft.id ? draft.name : t("brand.add")} size="sm">
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void execute(() => saveBrandAction({ id: draft.id, name: draft.name, slug: draft.slug, isVisible: draft.isVisible, logoId: draft.logo?.id ?? null }), {
                  success: t("saved"),
                  onSuccess: () => setDraft(null),
                });
              }}
            >
              <Field label={t("brand.name")} required>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={80} autoFocus />
              </Field>
              <Field label={tc("slug")} hint={tc("slugHint")}>
                <Input value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} maxLength={80} />
              </Field>
              <div>
                <p className="mb-1.5 text-[13px] font-medium text-ink-700">{t("brand.logo")}</p>
                <ImageField value={draft.logo} onChange={(logo) => setDraft({ ...draft, logo })} aspect="aspect-[3/2]" />
              </div>
              <Checkbox label={t("brand.isVisible")} checked={draft.isVisible} onChange={(e) => setDraft({ ...draft, isVisible: e.target.checked })} />
              <div className="flex justify-end gap-2.5">
                <Button variant="secondary" onClick={() => setDraft(null)}>
                  {tc("cancel")}
                </Button>
                <Button type="submit" loading={pending} disabled={!draft.name.trim()}>
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
