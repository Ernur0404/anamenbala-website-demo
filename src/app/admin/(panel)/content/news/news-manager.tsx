"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ExternalLink, Link2, Megaphone, Pencil, Plus, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/form";
import { Dialog, DialogContent, Switch } from "@/components/ui/primitives";
import { StatusPill, type Tone } from "@/components/ui/display";
import { Panel } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/controls";
import { useAdminAction } from "@/components/admin/use-action";
import { deleteAnnouncementAction, saveAnnouncementAction, toggleAnnouncementAction } from "@/server/actions/admin/content";

export type NewsItem = {
  id: string;
  titleRu: string;
  titleKk: string;
  textRu: string;
  textKk: string;
  url: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  state: "live" | "scheduled" | "ended" | "hidden";
  startLabel: string;
  endLabel: string;
  dateLabel: string;
};
type Draft = Pick<NewsItem, "titleRu" | "titleKk" | "textRu" | "textKk" | "url" | "startsAt" | "endsAt" | "isActive"> & { id: string | null };

const STATE_TONE: Record<NewsItem["state"], Tone> = { live: "sage", scheduled: "amber", ended: "gray", hidden: "gray" };
const small = "grid size-8 place-items-center rounded-md border border-line bg-white text-ink-500 hover:border-sage-400 hover:text-sage-700";
const EMPTY: Draft = { id: null, titleRu: "", titleKk: "", textRu: "", textKk: "", url: "", startsAt: "", endsAt: "", isActive: true };

export function NewsManager({ items }: { items: NewsItem[] }) {
  const t = useTranslations("admin.content.news");
  const tc = useTranslations("admin.common");
  const { pending, execute, fieldErrors, setFieldErrors } = useAdminAction();
  const [draft, setDraft] = useState<Draft | null>(null);

  const open = (value: Draft) => {
    setFieldErrors({});
    setDraft(value);
  };

  return (
    <>
      <Panel
        title={t("title")}
        subtitle={t("hint")}
        serif
        padded={false}
        action={
          <Button size="sm" onClick={() => open(EMPTY)}>
            <Plus />
            {t("add")}
          </Button>
        }
      >
        {items.length === 0 ? (
          <div className="flex flex-col items-center px-6 pb-10 text-center">
            <span className="mb-3 grid size-12 place-items-center rounded-full bg-sage-100 text-sage-700">
              <Megaphone className="size-5" />
            </span>
            <p className="text-sm font-semibold text-graphite">{t("empty")}</p>
            <p className="mt-1 max-w-md text-[13px] text-ink-500">{t("emptyHint")}</p>
          </div>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {items.map((a) => (
              <li key={a.id} className="flex flex-wrap items-start gap-3 px-5 py-4 sm:px-6">
                <div className="min-w-60 flex-1">
                  <p className="font-semibold text-graphite">{a.titleRu}</p>
                  {a.textRu && <p className="mt-1 line-clamp-2 text-[13px] text-ink-600">{a.textRu}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <StatusPill tone={STATE_TONE[a.state]} dot>
                      {a.state === "scheduled" ? t("state.scheduled", { date: a.startLabel }) : t(`state.${a.state}`)}
                    </StatusPill>
                    {a.endLabel && a.state !== "ended" && <StatusPill tone="beige">{t("until", { date: a.endLabel })}</StatusPill>}
                    {!a.titleKk && <StatusPill tone="amber">KZ —</StatusPill>}
                    {a.url && (
                      <span className="inline-flex items-center gap-1 text-xs text-ink-500">
                        <Link2 className="size-3.5" />
                        {a.url}
                      </span>
                    )}
                    <span className="text-xs text-ink-400">{a.dateLabel}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Switch
                    checked={a.isActive}
                    disabled={pending}
                    onCheckedChange={(isActive) => void execute(() => toggleAnnouncementAction({ id: a.id, isActive }), { success: tc("saved") })}
                    aria-label={t("fields.isActive")}
                    className="mr-1.5"
                  />
                  <button type="button" className={small} onClick={() => open({ ...a })} aria-label={tc("edit")}>
                    <Pencil className="size-3.5" />
                  </button>
                  <ConfirmButton
                    title={t("deleteTitle")}
                    text={a.titleRu}
                    confirmLabel={tc("delete")}
                    size="iconSm"
                    variant="ghost"
                    className="border border-line bg-white text-ink-600 hover:bg-powder-50 hover:text-powder-800"
                    aria-label={tc("delete")}
                    onConfirm={() => execute(() => deleteAnnouncementAction({ id: a.id }), { success: tc("deleted") })}
                  >
                    <Trash className="size-3.5" />
                  </ConfirmButton>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="flex items-center gap-1.5 border-t border-line px-5 py-3 text-xs text-ink-500 sm:px-6">
          <ExternalLink className="size-3.5" />
          <a href="/notifications" target="_blank" rel="noopener" className="font-semibold text-sage-700 hover:underline">
            {t("preview")}
          </a>
        </p>
      </Panel>

      <Dialog open={Boolean(draft)} onOpenChange={(v) => !v && setDraft(null)}>
        {draft && (
          <DialogContent title={draft.id ? draft.titleRu : t("new")} size="lg">
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void execute(() => saveAnnouncementAction({ ...draft, url: draft.url || null, startsAt: draft.startsAt || null, endsAt: draft.endsAt || null }), {
                  success: tc("saved"),
                  onSuccess: () => setDraft(null),
                });
              }}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label={t("fields.title")} required>
                  <Input value={draft.titleRu} onChange={(e) => setDraft({ ...draft, titleRu: e.target.value })} maxLength={120} />
                </Field>
                <Field label={t("fields.titleKk")}>
                  <Input value={draft.titleKk} onChange={(e) => setDraft({ ...draft, titleKk: e.target.value })} maxLength={120} />
                </Field>
                <Field label={t("fields.text")}>
                  <Textarea rows={4} value={draft.textRu} onChange={(e) => setDraft({ ...draft, textRu: e.target.value })} maxLength={600} />
                </Field>
                <Field label={t("fields.textKk")}>
                  <Textarea rows={4} value={draft.textKk} onChange={(e) => setDraft({ ...draft, textKk: e.target.value })} maxLength={600} />
                </Field>
              </div>
              <Field label={t("fields.url")} hint={t("fields.urlHint")} error={fieldErrors.url ? t("fields.urlInvalid") : undefined}>
                <Input value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} maxLength={300} placeholder="/sale" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("fields.startsAt")}>
                  <Input type="date" value={draft.startsAt} onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })} />
                </Field>
                <Field label={t("fields.endsAt")} error={fieldErrors.endsAt ? t("fields.endsInvalid") : undefined}>
                  <Input type="date" value={draft.endsAt} min={draft.startsAt || undefined} onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })} />
                </Field>
              </div>
              <p className="-mt-2 text-xs text-ink-500">{t("fields.datesHint")}</p>
              <Checkbox label={t("fields.isActive")} checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} />
              <div className="flex justify-end gap-2.5">
                <Button variant="secondary" onClick={() => setDraft(null)}>
                  {tc("cancel")}
                </Button>
                <Button type="submit" loading={pending} disabled={!draft.titleRu.trim()}>
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
