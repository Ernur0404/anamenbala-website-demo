"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, ExternalLink, Pencil, Plus, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { Dialog, DialogContent } from "@/components/ui/primitives";
import { Panel } from "@/components/admin/ui";
import { ImageField } from "@/components/admin/media";
import { ConfirmButton } from "@/components/admin/controls";
import { useAdminAction } from "@/components/admin/use-action";
import { deleteInstagramAction, moveInstagramAction, saveInstagramAction } from "@/server/actions/admin/content";
import { cn } from "@/lib/utils";

type Post = { id: string; url: string; isActive: boolean; media: { id: string; url: string | null } };
type Draft = { id: string | null; url: string; isActive: boolean; media: { id: string; url: string | null } | null };
const small = "grid size-7 place-items-center rounded-md bg-white/90 text-ink-600 shadow-soft hover:text-sage-700 disabled:opacity-30";

export function InstagramManager({ posts }: { posts: Post[] }) {
  const t = useTranslations("admin.content.instagram");
  const tc = useTranslations("admin.common");
  const { pending, execute } = useAdminAction();
  const [draft, setDraft] = useState<Draft | null>(null);

  return (
    <>
      <Panel
        title={t("title")}
        subtitle={`${t("hint")}. ${t("profile")}`}
        serif
        action={
          <Button size="sm" onClick={() => setDraft({ id: null, url: "https://www.instagram.com/p/", isActive: true, media: null })}>
            <Plus />
            {t("add")}
          </Button>
        }
      >
        {posts.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-500">{t("empty")}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {posts.map((p, i) => (
              <div key={p.id} className={cn("group relative aspect-square overflow-hidden rounded-xl bg-beige-50", !p.isActive && "opacity-50")}>
                {p.media.url && (
                  // eslint-disable-next-line @next/next/no-img-element -- превью поста
                  <img src={p.media.url} alt="" className="size-full object-cover" />
                )}
                <div className="absolute inset-x-1.5 top-1.5 flex justify-between">
                  <div className="flex gap-1">
                    <button type="button" className={small} disabled={i === 0 || pending} onClick={() => void execute(() => moveInstagramAction({ id: p.id, direction: "up" }), { success: false })} aria-label={tc("moveUp")}>
                      <ArrowLeft className="size-3.5" />
                    </button>
                    <button type="button" className={small} disabled={i === posts.length - 1 || pending} onClick={() => void execute(() => moveInstagramAction({ id: p.id, direction: "down" }), { success: false })} aria-label={tc("moveDown")}>
                      <ArrowRight className="size-3.5" />
                    </button>
                  </div>
                  <a href={p.url} target="_blank" rel="noreferrer" className={small} aria-label="Instagram">
                    <ExternalLink className="size-3.5" />
                  </a>
                </div>
                <div className="absolute inset-x-1.5 bottom-1.5 flex justify-end gap-1">
                  <button type="button" className={small} onClick={() => setDraft({ id: p.id, url: p.url, isActive: p.isActive, media: p.media })} aria-label={tc("edit")}>
                    <Pencil className="size-3.5" />
                  </button>
                  <ConfirmButton title={t("deleteTitle")} confirmLabel={tc("delete")} size="iconSm" variant="ghost" className="size-7 bg-white/90 text-powder-800 shadow-soft" aria-label={tc("delete")} onConfirm={() => execute(() => deleteInstagramAction({ id: p.id }), { success: tc("deleted") })}>
                    <Trash className="size-3.5" />
                  </ConfirmButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Dialog open={Boolean(draft)} onOpenChange={(v) => !v && setDraft(null)}>
        {draft && (
          <DialogContent title={t("add")} size="sm">
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!draft.media) return;
                void execute(() => saveInstagramAction({ id: draft.id, url: draft.url, isActive: draft.isActive, mediaId: draft.media!.id }), { success: tc("saved"), onSuccess: () => setDraft(null) });
              }}
            >
              <div>
                <p className="mb-1.5 text-[13px] font-medium text-ink-700">{t("photo")}</p>
                <ImageField value={draft.media} onChange={(media) => setDraft({ ...draft, media })} aspect="aspect-square" className="mx-auto max-w-[220px]" />
              </div>
              <Field label={t("url")} required>
                <Input type="url" value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} maxLength={300} />
              </Field>
              <Checkbox label={tc("visible")} checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} />
              <div className="flex justify-end gap-2.5">
                <Button variant="secondary" onClick={() => setDraft(null)}>
                  {tc("cancel")}
                </Button>
                <Button type="submit" loading={pending} disabled={!draft.media || !/^https?:\/\/.+/.test(draft.url)}>
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
