"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckCircle2, ImagePlus, Star, X } from "lucide-react";
import { submitReviewAction } from "@/server/actions/reviews";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { cn } from "@/lib/utils";

export function ReviewForm({ productId, defaultName, onDone }: { productId?: string | null; defaultName?: string; onDone?: () => void }) {
  const t = useTranslations();
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  if (done) {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-sage-50 p-4 text-sm font-medium text-sage-800">
        <CheckCircle2 className="size-5 shrink-0" />
        {t("reviews.thanks")}
      </div>
    );
  }

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    form.set("rating", String(rating));
    if (productId) form.set("productId", productId);
    form.delete("photos");
    for (const f of files) form.append("photos", f);
    startTransition(async () => {
      const result = await submitReviewAction(form);
      if (result.ok) {
        setDone(true);
        onDone?.();
      } else {
        setErrors(result.fieldErrors ?? {});
        toast.error(t(`errors.${result.code}`));
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-line bg-white p-5">
      <div>
        <p className="mb-2 text-[13px] font-medium text-ink-700">{t("reviews.rating")}</p>
        <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((i) => (
            <button key={i} type="button" onClick={() => setRating(i)} onMouseEnter={() => setHover(i)} aria-label={`${i}`} aria-pressed={rating === i}>
              <Star className={cn("size-7 transition-colors", i <= (hover || rating) ? "fill-[#e9b949] text-[#e9b949]" : "fill-line text-line-strong")} />
            </button>
          ))}
        </div>
      </div>
      <Field label={t("reviews.yourName")} required error={errors.name && t(`errors.${errors.name === "required" ? "required" : "invalid"}`)}>
        <Input name="name" defaultValue={defaultName} required minLength={2} maxLength={60} invalid={Boolean(errors.name)} />
      </Field>
      <Field label={t("reviews.text")} required error={errors.text && t("errors.tooShort")}>
        <Textarea name="text" required minLength={10} maxLength={3000} placeholder={t("reviews.textPlaceholder")} invalid={Boolean(errors.text)} />
      </Field>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <div>
        <p className="mb-2 text-[13px] font-medium text-ink-700">{t("reviews.photos")}</p>
        <div className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <span key={i} className="relative size-16 overflow-hidden rounded-md border border-line bg-beige-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={URL.createObjectURL(f)} alt="" className="size-full object-cover" />
              <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="absolute top-0.5 right-0.5 grid size-5 place-items-center rounded-full bg-white/90 text-ink-700" aria-label={t("common.delete")}>
                <X className="size-3" />
              </button>
            </span>
          ))}
          {files.length < 3 && (
            <button type="button" onClick={() => fileRef.current?.click()} className="grid size-16 place-items-center rounded-md border border-dashed border-line-strong text-ink-400 hover:border-sage-500 hover:text-sage-700">
              <ImagePlus className="size-6" />
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const picked = [...(e.target.files ?? [])].filter((f) => f.size <= 8 * 1024 * 1024);
            setFiles((prev) => [...prev, ...picked].slice(0, 3));
            e.target.value = "";
          }}
        />
      </div>
      <Button type="submit" loading={pending}>
        {t("reviews.submit")}
      </Button>
    </form>
  );
}
