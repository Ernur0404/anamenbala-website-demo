"use client";

import { useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ImagePlus, LoaderCircle, Trash, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

export type UploadedMedia = { id: string; url: string | null; thumbUrl?: string | null; kind: "IMAGE" | "VIDEO" };

/** Загрузка файла в медиатеку (фото → WebP-варианты, видео — как есть) */
export async function uploadMedia(file: File, kind: "image" | "video" = "image"): Promise<UploadedMedia> {
  const form = new FormData();
  form.append("file", file);
  form.append("kind", kind);
  const res = await fetch("/api/admin/media", { method: "POST", body: form });
  const data = (await res.json().catch(() => ({}))) as { id?: string; url?: string; thumbUrl?: string; kind?: "IMAGE" | "VIDEO"; message?: string; error?: string };
  if (!res.ok || !data.id) throw new Error(data.message || data.error || "upload failed");
  return { id: data.id, url: data.url ?? null, thumbUrl: data.thumbUrl ?? null, kind: data.kind ?? (kind === "video" ? "VIDEO" : "IMAGE") };
}

/** Зона «перетащите файлы сюда» */
export function DropZone({
  onFiles,
  accept = "image/*",
  multiple,
  busy,
  hint,
  className,
  children,
}: {
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  busy?: boolean;
  hint?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  const t = useTranslations("admin.common");
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !busy && input.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const files = [...e.dataTransfer.files];
        if (files.length) onFiles(multiple ? files : files.slice(0, 1));
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors",
        over ? "border-sage-500 bg-sage-50" : "border-line-strong bg-cream/60 hover:border-sage-400 hover:bg-sage-50/60",
        busy && "pointer-events-none opacity-70",
        className,
      )}
    >
      {children ?? (
        <>
          <span className="grid size-11 place-items-center rounded-full bg-white text-sage-700 shadow-soft">{busy ? <LoaderCircle className="size-5 animate-spin" /> : <Upload className="size-5" />}</span>
          <span className="text-[13.5px] font-semibold text-graphite">{busy ? t("uploading") : t("dropHere")}</span>
          <span className="text-[12px] text-ink-500">{hint ?? t("imageHint")}</span>
        </>
      )}
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          if (files.length) onFiles(files);
        }}
      />
    </div>
  );
}

/** Одно изображение (баннер, категория, логотип…): превью, замена, удаление */
export function ImageField({
  value,
  onChange,
  aspect = "aspect-[16/9]",
  hint,
  className,
}: {
  value: { id: string; url: string | null } | null;
  onChange: (value: { id: string; url: string | null } | null) => void;
  aspect?: string;
  hint?: ReactNode;
  className?: string;
}) {
  const t = useTranslations("admin.common");
  const [busy, setBusy] = useState(false);
  const upload = async (files: File[]) => {
    setBusy(true);
    try {
      const media = await uploadMedia(files[0], "image");
      onChange({ id: media.id, url: media.url });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (!value) return <DropZone onFiles={upload} busy={busy} hint={hint} className={cn(aspect, "min-h-32", className)} />;
  return (
    <div className={cn("group relative overflow-hidden rounded-xl border border-line bg-beige-50", aspect, className)}>
      {value.url && (
        // eslint-disable-next-line @next/next/no-img-element -- превью в админке
        <img src={value.url} alt="" className="size-full object-cover" />
      )}
      <div className="absolute inset-x-0 bottom-0 flex justify-end gap-2 bg-gradient-to-t from-graphite/60 to-transparent p-2.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
        <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md bg-white px-3 text-[12.5px] font-semibold text-graphite shadow-soft hover:bg-sage-50">
          {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />}
          {t("replace")}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const files = [...(e.target.files ?? [])];
              e.target.value = "";
              if (files.length) void upload(files);
            }}
          />
        </label>
        <button type="button" onClick={() => onChange(null)} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-white px-3 text-[12.5px] font-semibold text-powder-800 shadow-soft hover:bg-powder-50">
          <Trash className="size-3.5" />
          {t("remove")}
        </button>
      </div>
    </div>
  );
}
