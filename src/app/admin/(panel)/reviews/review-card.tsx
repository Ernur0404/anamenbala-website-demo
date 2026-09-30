"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { BadgeCheck, Check, MessageSquareReply, Plus, Star, Trash, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/form";
import { Dialog, DialogContent, Switch } from "@/components/ui/primitives";
import { StatusPill, Stars } from "@/components/ui/display";
import { Thumb } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/controls";
import { DropZone, uploadMedia } from "@/components/admin/media";
import { ProductMultiPicker, type PickedProduct } from "@/components/admin/product-picker";
import { useAdminAction } from "@/components/admin/use-action";
import { createReviewAction, deleteReviewAction, featureReviewAction, moderateReviewAction, replyReviewAction } from "@/server/actions/admin/reviews";
import { cn } from "@/lib/utils";

export type ReviewCardData = {
  id: string;
  authorName: string;
  rating: number;
  text: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  source: "SITE" | "ADMIN";
  isVerified: boolean;
  isFeatured: boolean;
  replyText: string;
  date: string;
  product: { id: string; name: string; slug: string; imageUrl: string | null } | null;
  photos: { id: string; url: string | null; thumb: string | null }[];
  moderatedBy: string | null;
};

const STATUS_TONE = { PENDING: "amber", APPROVED: "sage", REJECTED: "gray" } as const;

export function ReviewCard({ review }: { review: ReviewCardData }) {
  const t = useTranslations("admin.reviews");
  const { pending, execute } = useAdminAction();
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState(review.replyText);
  const [photo, setPhoto] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4 px-5 py-5 sm:px-6 lg:flex-row">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-graphite">{review.authorName}</span>
          <Stars value={review.rating} />
          <StatusPill tone={STATUS_TONE[review.status]}>{t(`tabs.${review.status}`)}</StatusPill>
          {review.isVerified && (
            <span className="inline-flex items-center gap-1 text-[12px] font-medium text-sage-700">
              <BadgeCheck className="size-3.5" />
              {t("verified")}
            </span>
          )}
          {review.source === "ADMIN" && <span className="text-[12px] text-ink-400">{t("fromAdmin")}</span>}
          <span className="text-[12px] text-ink-400">{review.date}</span>
        </div>
        {review.product ? (
          <Link href={`/admin/products/${review.product.id}`} className="mt-2 inline-flex items-center gap-2 text-[13px] text-ink-600 hover:text-sage-700">
            <Thumb src={review.product.imageUrl} size={26} />
            {review.product.name}
          </Link>
        ) : (
          <p className="mt-2 text-[13px] text-ink-500">{t("aboutStore")}</p>
        )}
        <p className="mt-2.5 text-[14.5px] leading-relaxed whitespace-pre-line text-graphite">{review.text}</p>
        {review.photos.length > 0 && (
          <div className="mt-3 flex gap-2">
            {review.photos.map((p) => (
              <button key={p.id} type="button" onClick={() => setPhoto(p.url)} className="overflow-hidden rounded-lg border border-line">
                <Thumb src={p.thumb} size={72} className="rounded-none" />
              </button>
            ))}
          </div>
        )}
        {review.replyText && !replying && (
          <div className="mt-3 rounded-lg border-l-2 border-sage-500 bg-sage-50 px-3.5 py-2.5 text-[13.5px]">
            <p className="text-[12px] font-semibold text-sage-800">{t("reply")}</p>
            <p className="mt-0.5 whitespace-pre-line text-ink-700">{review.replyText}</p>
          </div>
        )}
        {replying && (
          <div className="mt-3 space-y-2">
            <Textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder={t("replyPlaceholder")} maxLength={2000} autoFocus />
            <div className="flex gap-2">
              <Button size="sm" loading={pending} onClick={() => void execute(() => replyReviewAction({ id: review.id, text: reply || null }), { success: t("replySaved"), onSuccess: () => setReplying(false) })}>
                {t("saveReply")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setReplying(false)}>
                <X />
              </Button>
            </div>
          </div>
        )}
        {review.moderatedBy && <p className="mt-2 text-[11.5px] text-ink-400">{t("moderatedBy", { name: review.moderatedBy })}</p>}
      </div>

      <div className="flex shrink-0 flex-wrap items-start gap-2 lg:w-56 lg:flex-col lg:items-stretch">
        {review.status !== "APPROVED" && (
          <Button size="sm" loading={pending} onClick={() => void execute(() => moderateReviewAction({ id: review.id, status: "APPROVED" }), { success: t("approved") })}>
            <Check />
            {t("approve")}
          </Button>
        )}
        {review.status === "PENDING" && (
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => void execute(() => moderateReviewAction({ id: review.id, status: "REJECTED" }), { success: t("rejected") })}>
            <X />
            {t("reject")}
          </Button>
        )}
        {review.status === "APPROVED" && (
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => void execute(() => moderateReviewAction({ id: review.id, status: "PENDING" }), { success: false })}>
            <Undo2 />
            {t("restore")}
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => setReplying((v) => !v)}>
          <MessageSquareReply />
          {review.replyText ? t("editReply") : t("reply")}
        </Button>
        {review.status === "APPROVED" && (
          <label className="flex items-center gap-2 px-1 text-[12.5px] font-medium text-ink-700">
            <Switch checked={review.isFeatured} disabled={pending} onCheckedChange={(isFeatured) => void execute(() => featureReviewAction({ id: review.id, isFeatured }), { success: false })} />
            {t("feature")}
          </label>
        )}
        <ConfirmButton title={t("deleteTitle", { author: review.authorName })} confirmLabel={t("delete")} size="sm" variant="ghost" className="text-powder-800 hover:bg-powder-50" onConfirm={() => execute(() => deleteReviewAction({ id: review.id }), { success: false })}>
          <Trash />
          {t("delete")}
        </ConfirmButton>
      </div>

      <Dialog open={Boolean(photo)} onOpenChange={(v) => !v && setPhoto(null)}>
        {photo && (
          <DialogContent title={review.authorName} hideTitle size="lg" className="p-2 sm:p-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- фото из отзыва */}
            <img src={photo} alt="" className="max-h-[80dvh] w-full rounded-lg object-contain" />
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

export function AddReviewButton() {
  const t = useTranslations("admin.reviews");
  const tc = useTranslations("admin.common");
  const { pending, execute } = useAdminAction();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ authorName: "", rating: 5, text: "", date: "", isFeatured: true });
  const [product, setProduct] = useState<PickedProduct[]>([]);
  const [photos, setPhotos] = useState<{ id: string; url: string | null }[]>([]);
  const [uploading, setUploading] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus />
        {t("add")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={t("form.title")} size="md">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void execute(() => createReviewAction({ ...form, date: form.date || null, productId: product[0]?.id ?? null, photoIds: photos.map((p) => p.id) }), {
                success: t("form.created"),
                onSuccess: () => {
                  setOpen(false);
                  setForm({ authorName: "", rating: 5, text: "", date: "", isFeatured: true });
                  setProduct([]);
                  setPhotos([]);
                },
              });
            }}
          >
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <Field label={t("form.author")} required>
                <Input value={form.authorName} onChange={(e) => setForm({ ...form, authorName: e.target.value })} maxLength={80} />
              </Field>
              <Field label={t("form.rating")}>
                <div className="flex h-11 items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={() => setForm({ ...form, rating: n })} aria-label={t("stars", { count: n })} className="p-0.5">
                      <Star className={cn("size-6", n <= form.rating ? "fill-[#e0a44b] text-[#e0a44b]" : "text-line-strong")} />
                    </button>
                  ))}
                </div>
              </Field>
            </div>
            <Field label={t("form.text")} required>
              <Textarea rows={4} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} maxLength={3000} />
            </Field>
            <div>
              <p className="mb-1.5 text-[13px] font-medium text-ink-700">{t("form.product")}</p>
              <ProductMultiPicker value={product} onChange={(next) => setProduct(next.slice(-1))} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("form.date")}>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </Field>
              <div className="flex items-end pb-3">
                <Checkbox label={t("form.featured")} checked={form.isFeatured} onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })} />
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-[13px] font-medium text-ink-700">{t("form.photos")}</p>
              <div className="flex flex-wrap gap-2">
                {photos.map((p) => (
                  <div key={p.id} className="relative">
                    <Thumb src={p.url} size={72} className="rounded-lg" />
                    <button type="button" onClick={() => setPhotos((list) => list.filter((x) => x.id !== p.id))} className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-white text-powder-800 shadow-soft" aria-label={tc("remove")}>
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
                {photos.length < 3 && (
                  <DropZone
                    multiple
                    busy={uploading}
                    className="size-[72px] p-1"
                    onFiles={async (files) => {
                      setUploading(true);
                      for (const file of files.slice(0, 3 - photos.length)) {
                        try {
                          const m = await uploadMedia(file, "image");
                          setPhotos((list) => [...list, { id: m.id, url: m.thumbUrl ?? m.url }]);
                        } catch (err) {
                          toast.error((err as Error).message);
                        }
                      }
                      setUploading(false);
                    }}
                  >
                    <Plus className="size-5 text-sage-700" />
                  </DropZone>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2.5">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                {tc("cancel")}
              </Button>
              <Button type="submit" loading={pending} disabled={!form.authorName.trim() || !form.text.trim()}>
                {tc("save")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
