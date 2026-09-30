"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, LoaderCircle, Plus, Trash, Video } from "lucide-react";
import { Field, Input } from "@/components/ui/form";
import { DropZone, uploadMedia } from "@/components/admin/media";
import { cn } from "@/lib/utils";
import type { MediaState } from "./state";

type ColorOption = { id: string; label: string; colorHex: string | null };

function PhotoTile({ item, index, colors, onColor, onRemove }: { item: MediaState; index: number; colors: ColorOption[]; onColor: (id: string | null) => void; onRemove: () => void }) {
  const t = useTranslations("admin.products.media");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.mediaId });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("group relative overflow-hidden rounded-xl border border-line bg-white", isDragging && "z-10 shadow-pop ring-2 ring-sage-500")}
    >
      <div className="relative aspect-square bg-beige-50">
        {item.url && (
          // eslint-disable-next-line @next/next/no-img-element -- превью в админке
          <img src={item.url} alt="" className="size-full object-cover" draggable={false} />
        )}
        {index === 0 && <span className="absolute top-2 left-2 rounded-full bg-sage-700 px-2 py-0.5 text-[10.5px] font-bold text-white">{t("main")}</span>}
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="absolute top-2 right-2 grid size-7 cursor-grab touch-none place-items-center rounded-md bg-white/90 text-ink-600 shadow-soft active:cursor-grabbing"
          aria-label="drag"
        >
          <GripVertical className="size-4" />
        </button>
        <button type="button" onClick={onRemove} className="absolute right-2 bottom-2 grid size-7 place-items-center rounded-md bg-white/90 text-powder-800 shadow-soft hover:bg-powder-50" aria-label={t("remove")}>
          <Trash className="size-3.5" />
        </button>
      </div>
      {colors.length > 0 && (
        <select
          value={item.colorValueId ?? ""}
          onChange={(e) => onColor(e.target.value || null)}
          aria-label={t("color")}
          className="h-8 w-full cursor-pointer border-t border-line bg-white px-2 text-[12px] text-ink-700 outline-none"
        >
          <option value="">{t("anyColor")}</option>
          {colors.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

export function MediaSection({
  media,
  onMedia,
  colors,
  video,
  onVideo,
}: {
  media: MediaState[];
  onMedia: (next: MediaState[]) => void;
  colors: ColorOption[];
  video: { mediaId: string | null; fileUrl: string | null; url: string };
  onVideo: (next: { mediaId: string | null; fileUrl: string | null; url: string }) => void;
}) {
  const t = useTranslations("admin.products");
  const tc = useTranslations("admin.common");
  const [uploading, setUploading] = useState(0);
  const [videoBusy, setVideoBusy] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const upload = async (files: File[]) => {
    setUploading((n) => n + files.length);
    const added: MediaState[] = [];
    for (const file of files) {
      try {
        const m = await uploadMedia(file, "image");
        added.push({ mediaId: m.id, url: m.thumbUrl ?? m.url, colorValueId: null });
      } catch (e) {
        toast.error(`${t("media.uploadFailed", { name: file.name })}: ${(e as Error).message}`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (added.length) onMedia([...media, ...added]);
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = media.findIndex((m) => m.mediaId === active.id);
    const to = media.findIndex((m) => m.mediaId === over.id);
    onMedia(arrayMove(media, from, to));
  };

  return (
    <div className="space-y-5">
      <p className="text-[12.5px] text-ink-500">{t("media.hint")}</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={media.map((m) => m.mediaId)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {media.map((m, i) => (
              <PhotoTile
                key={m.mediaId}
                item={m}
                index={i}
                colors={colors}
                onColor={(colorValueId) => onMedia(media.map((x) => (x.mediaId === m.mediaId ? { ...x, colorValueId } : x)))}
                onRemove={() => onMedia(media.filter((x) => x.mediaId !== m.mediaId))}
              />
            ))}
            {Array.from({ length: uploading }, (_, i) => (
              <div key={`up-${i}`} className="grid aspect-square place-items-center rounded-xl border border-dashed border-line-strong bg-cream">
                <LoaderCircle className="size-6 animate-spin text-sage-600" />
              </div>
            ))}
            <DropZone onFiles={upload} multiple className="aspect-square px-3 py-3">
              <span className="grid size-10 place-items-center rounded-full bg-white text-sage-700 shadow-soft">
                <Plus className="size-5" />
              </span>
              <span className="text-[12.5px] font-semibold text-graphite">{tc("upload")}</span>
              <span className="text-[11px] leading-tight text-ink-500">{tc("imageHint")}</span>
            </DropZone>
          </div>
        </SortableContext>
      </DndContext>

      <div className="rounded-xl border border-line p-4">
        <p className="mb-3 flex items-center gap-2 text-[13.5px] font-semibold text-graphite">
          <Video className="size-4 text-sage-700" />
          {t("fields.video")}
        </p>
        {video.mediaId ? (
          <div className="flex flex-wrap items-center gap-3">
            {video.fileUrl && <video src={video.fileUrl} className="h-28 rounded-lg bg-graphite" controls preload="metadata" />}
            <button type="button" onClick={() => onVideo({ mediaId: null, fileUrl: null, url: "" })} className="text-[13px] font-semibold text-powder-800 hover:underline">
              {t("media.removeVideo")}
            </button>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
            <Field label={t("fields.videoUrl")}>
              <Input value={video.url} onChange={(e) => onVideo({ ...video, url: e.target.value })} placeholder="https://www.youtube.com/watch?v=…" />
            </Field>
            <span className="text-center text-[12px] text-ink-400 md:pt-6">{t("fields.videoOr")}</span>
            <DropZone
              accept="video/mp4,video/webm"
              busy={videoBusy}
              hint={tc("videoHint")}
              className="py-4"
              onFiles={async (files) => {
                setVideoBusy(true);
                try {
                  const m = await uploadMedia(files[0], "video");
                  onVideo({ mediaId: m.id, fileUrl: m.url, url: "" });
                  toast.success(t("media.videoUploaded"));
                } catch (e) {
                  toast.error((e as Error).message);
                } finally {
                  setVideoBusy(false);
                }
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
