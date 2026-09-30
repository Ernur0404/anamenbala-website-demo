"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/form";
import { Dialog, DialogContent } from "@/components/ui/primitives";
import { StatusPill } from "@/components/ui/display";
import { Panel } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/controls";
import { useAdminAction } from "@/components/admin/use-action";
import { deleteFaqAction, moveFaqAction, saveFaqAction } from "@/server/actions/admin/content";

type Item = { id: string; questionRu: string; questionKk: string; answerRu: string; answerKk: string; isActive: boolean; showOnDelivery: boolean };
type Draft = Omit<Item, "id"> & { id: string | null };
const small = "grid size-8 place-items-center rounded-md border border-line bg-white text-ink-500 hover:border-sage-400 hover:text-sage-700 disabled:opacity-30";

export function FaqManager({ items }: { items: Item[] }) {
  const t = useTranslations("admin.content.faq");
  const tc = useTranslations("admin.common");
  const { pending, execute } = useAdminAction();
  const [draft, setDraft] = useState<Draft | null>(null);

  return (
    <>
      <Panel
        title={t("title")}
        subtitle={t("hint")}
        serif
        padded={false}
        action={
          <Button size="sm" onClick={() => setDraft({ id: null, questionRu: "", questionKk: "", answerRu: "", answerKk: "", isActive: true, showOnDelivery: true })}>
            <Plus />
            {t("add")}
          </Button>
        }
      >
        {items.length === 0 ? (
          <p className="px-6 pb-10 text-center text-sm text-ink-500">{t("empty")}</p>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {items.map((f, i) => (
              <li key={f.id} className="flex flex-wrap items-start gap-3 px-5 py-4 sm:px-6">
                <div className="min-w-60 flex-1">
                  <p className="font-semibold text-graphite">{f.questionRu}</p>
                  <p className="mt-1 line-clamp-2 text-[13px] text-ink-600">{f.answerRu}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {!f.isActive && <StatusPill tone="gray">{tc("hidden")}</StatusPill>}
                    {f.showOnDelivery && <StatusPill tone="sage">{t("onDelivery")}</StatusPill>}
                    {!f.questionKk && <StatusPill tone="amber">KZ —</StatusPill>}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button type="button" className={small} disabled={i === 0 || pending} onClick={() => void execute(() => moveFaqAction({ id: f.id, direction: "up" }), { success: false })} aria-label={tc("moveUp")}>
                    <ArrowUp className="size-3.5" />
                  </button>
                  <button type="button" className={small} disabled={i === items.length - 1 || pending} onClick={() => void execute(() => moveFaqAction({ id: f.id, direction: "down" }), { success: false })} aria-label={tc("moveDown")}>
                    <ArrowDown className="size-3.5" />
                  </button>
                  <button type="button" className={small} onClick={() => setDraft(f)} aria-label={tc("edit")}>
                    <Pencil className="size-3.5" />
                  </button>
                  <ConfirmButton title={t("deleteTitle")} text={f.questionRu} confirmLabel={tc("delete")} size="iconSm" variant="ghost" className="border border-line bg-white text-ink-600 hover:bg-powder-50 hover:text-powder-800" aria-label={tc("delete")} onConfirm={() => execute(() => deleteFaqAction({ id: f.id }), { success: tc("deleted") })}>
                    <Trash className="size-3.5" />
                  </ConfirmButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Dialog open={Boolean(draft)} onOpenChange={(v) => !v && setDraft(null)}>
        {draft && (
          <DialogContent title={draft.id ? draft.questionRu : t("add")} size="lg">
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void execute(() => saveFaqAction(draft), { success: tc("saved"), onSuccess: () => setDraft(null) });
              }}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label={t("question")} required>
                  <Input value={draft.questionRu} onChange={(e) => setDraft({ ...draft, questionRu: e.target.value })} maxLength={300} />
                </Field>
                <Field label={t("questionKk")}>
                  <Input value={draft.questionKk} onChange={(e) => setDraft({ ...draft, questionKk: e.target.value })} maxLength={300} />
                </Field>
                <Field label={t("answer")} required>
                  <Textarea rows={5} value={draft.answerRu} onChange={(e) => setDraft({ ...draft, answerRu: e.target.value })} maxLength={3000} />
                </Field>
                <Field label={t("answerKk")}>
                  <Textarea rows={5} value={draft.answerKk} onChange={(e) => setDraft({ ...draft, answerKk: e.target.value })} maxLength={3000} />
                </Field>
              </div>
              <div className="flex flex-wrap gap-5">
                <Checkbox label={t("isActive")} checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} />
                <Checkbox label={t("onDelivery")} checked={draft.showOnDelivery} onChange={(e) => setDraft({ ...draft, showOnDelivery: e.target.checked })} />
              </div>
              <div className="flex justify-end gap-2.5">
                <Button variant="secondary" onClick={() => setDraft(null)}>
                  {tc("cancel")}
                </Button>
                <Button type="submit" loading={pending} disabled={!draft.questionRu.trim() || !draft.answerRu.trim()}>
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
