"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Plus, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { Dialog, DialogContent } from "@/components/ui/primitives";
import { ProductBadge, StatusPill } from "@/components/ui/display";
import { ConfirmButton } from "@/components/admin/controls";
import { useAdminAction } from "@/components/admin/use-action";
import { deleteBadgeAction, saveBadgeAction } from "@/server/actions/admin/catalog";
import { cn } from "@/lib/utils";
import { SortButtons } from "../sort-buttons";

type Style = "SAGE" | "POWDER" | "BEIGE" | "GRAPHITE";
type Badge = { id: string; code: string; nameRu: string; nameKk: string; style: Style; isActive: boolean; products: number };
type Draft = Omit<Badge, "products" | "id" | "code"> & { id: string | null };

export function BadgesList({ badges }: { badges: Badge[] }) {
  const t = useTranslations("admin.catalog");
  const tc = useTranslations("admin.common");
  const tp = useTranslations("admin.products");
  const { pending, execute } = useAdminAction();
  const [draft, setDraft] = useState<Draft | null>(null);

  return (
    <>
      <div className="flex justify-end px-5 pt-5 pb-3 sm:px-6">
        <Button size="sm" onClick={() => setDraft({ id: null, nameRu: "", nameKk: "", style: "SAGE", isActive: true })}>
          <Plus />
          {t("badge.add")}
        </Button>
      </div>
      <ul className="divide-y divide-line border-t border-line">
        {badges.map((b, i) => (
          <li key={b.id} className="flex flex-wrap items-center gap-3 px-5 py-3 sm:px-6">
            <ProductBadge style={b.style}>{b.nameRu}</ProductBadge>
            <div className="min-w-40 flex-1 text-[12.5px] text-ink-500">
              {b.nameKk && <span>{b.nameKk} · </span>}
              {tp("title")}: {b.products}
            </div>
            {!b.isActive && <StatusPill tone="gray">{tc("inactive")}</StatusPill>}
            <SortButtons kind="badge" id={b.id} first={i === 0} last={i === badges.length - 1} />
            <button type="button" onClick={() => setDraft({ id: b.id, nameRu: b.nameRu, nameKk: b.nameKk, style: b.style, isActive: b.isActive })} className="grid size-8 place-items-center rounded-md border border-line bg-white text-ink-600 hover:border-sage-400 hover:text-sage-700" aria-label={tc("edit")}>
              <Pencil className="size-3.5" />
            </button>
            <ConfirmButton title={`${tc("delete")} «${b.nameRu}»?`} text={t("badge.deleteText")} confirmLabel={tc("delete")} size="iconSm" variant="ghost" className="border border-line bg-white text-ink-600 hover:bg-powder-50 hover:text-powder-800" onConfirm={() => execute(() => deleteBadgeAction({ id: b.id }), { success: t("deleted") })} aria-label={tc("delete")}>
              <Trash className="size-3.5" />
            </ConfirmButton>
          </li>
        ))}
      </ul>

      <Dialog open={Boolean(draft)} onOpenChange={(v) => !v && setDraft(null)}>
        {draft && (
          <DialogContent title={draft.id ? draft.nameRu : t("badge.add")} size="sm">
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void execute(() => saveBadgeAction({ ...draft }), { success: t("saved"), onSuccess: () => setDraft(null) });
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("badge.nameRu")} required>
                  <Input value={draft.nameRu} onChange={(e) => setDraft({ ...draft, nameRu: e.target.value })} maxLength={30} autoFocus />
                </Field>
                <Field label={t("badge.nameKk")}>
                  <Input value={draft.nameKk} onChange={(e) => setDraft({ ...draft, nameKk: e.target.value })} maxLength={30} />
                </Field>
              </div>
              <div>
                <p className="mb-2 text-[13px] font-medium text-ink-700">{t("badge.style")}</p>
                <div className="flex flex-wrap gap-2">
                  {(["SAGE", "POWDER", "BEIGE", "GRAPHITE"] as const).map((s) => (
                    <button key={s} type="button" onClick={() => setDraft({ ...draft, style: s })} aria-pressed={draft.style === s} className={cn("rounded-full p-1 transition-all", draft.style === s ? "ring-2 ring-sage-600" : "opacity-70 hover:opacity-100")}>
                      <ProductBadge style={s}>{draft.nameRu || t(`badge.styles.${s}`)}</ProductBadge>
                    </button>
                  ))}
                </div>
              </div>
              <Checkbox label={t("badge.isActive")} checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} />
              <div className="flex justify-end gap-2.5">
                <Button variant="secondary" onClick={() => setDraft(null)}>
                  {tc("cancel")}
                </Button>
                <Button type="submit" loading={pending} disabled={!draft.nameRu.trim()}>
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
