"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowRight, ArrowUp, Pencil, Trash } from "lucide-react";
import { Switch } from "@/components/ui/primitives";
import { ConfirmButton } from "@/components/admin/controls";
import { useAdminAction } from "@/components/admin/use-action";
import { deleteBannerAction, moveBannerAction, toggleBannerAction } from "@/server/actions/admin/content";
import { cn } from "@/lib/utils";

export type BannerRowData = {
  id: string;
  title: string;
  text: string | null;
  buttonText: string | null;
  imageUrl: string | null;
  isActive: boolean;
  order: number;
  first: boolean;
  last: boolean;
};

const small = "grid size-7 place-items-center rounded-md border border-line bg-white text-ink-500 hover:border-sage-400 hover:text-sage-700 disabled:opacity-30";

/** Баннер в списке — как в макете: фото, заголовок, текст, кнопка «Перейти», порядок, переключатель */
export function BannerRow({ banner }: { banner: BannerRowData }) {
  const t = useTranslations("admin.content");
  const tc = useTranslations("admin.common");
  const { pending, execute } = useAdminAction();
  return (
    <div className={cn("flex flex-col gap-4 rounded-xl border border-line bg-cream/40 p-3 sm:flex-row sm:items-center", !banner.isActive && "opacity-70")}>
      <div className="relative flex min-w-0 flex-1 overflow-hidden rounded-lg bg-gradient-to-r from-beige-50 to-beige-100">
        <div className="relative aspect-[16/9] w-2/5 shrink-0 bg-beige-100 sm:aspect-auto sm:h-32">
          {banner.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- превью баннера
            <img src={banner.imageUrl} alt="" className="size-full object-cover" />
          )}
          <span className={cn("absolute top-2 left-2 rounded-md px-2 py-0.5 text-[11px] font-bold text-white", banner.isActive ? "bg-sage-700" : "bg-ink-400")}>{banner.isActive ? t("active") : t("inactive")}</span>
        </div>
        <div className="min-w-0 flex-1 px-4 py-3">
          <p className="heading-section line-clamp-2 text-[20px] text-graphite">{banner.title}</p>
          {banner.text && <p className="mt-1 line-clamp-1 text-[12.5px] text-ink-600">{banner.text}</p>}
          {banner.buttonText && (
            <span className="mt-2.5 inline-flex h-8 items-center gap-1.5 rounded-md bg-sage-700 px-3 text-[12px] font-semibold text-white">
              {banner.buttonText}
              <ArrowRight className="size-3.5" />
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 sm:w-44 sm:flex-col sm:items-end">
        <div className="flex items-center gap-2 text-[12px] text-ink-500">
          {t("order", { n: banner.order })}
          <button type="button" className={small} disabled={banner.first || pending} onClick={() => void execute(() => moveBannerAction({ id: banner.id, direction: "up" }), { success: false })} aria-label={t("moveUp")}>
            <ArrowUp className="size-3.5" />
          </button>
          <button type="button" className={small} disabled={banner.last || pending} onClick={() => void execute(() => moveBannerAction({ id: banner.id, direction: "down" }), { success: false })} aria-label={t("moveDown")}>
            <ArrowDown className="size-3.5" />
          </button>
        </div>
        <Switch checked={banner.isActive} disabled={pending} onCheckedChange={(isActive) => void execute(() => toggleBannerAction({ id: banner.id, isActive }), { success: t("saved") })} aria-label={t("banners.fields.isActive")} />
        <div className="ml-auto flex gap-1.5 sm:ml-0">
          <Link href={`/admin/content/banners/${banner.id}`} className="grid size-8 place-items-center rounded-md border border-line bg-white text-ink-600 hover:border-sage-400 hover:text-sage-700" aria-label={tc("edit")}>
            <Pencil className="size-3.5" />
          </Link>
          <ConfirmButton
            title={t("banners.deleteTitle", { title: banner.title })}
            confirmLabel={tc("delete")}
            size="iconSm"
            variant="ghost"
            className="border border-line bg-white text-ink-600 hover:bg-powder-50 hover:text-powder-800"
            aria-label={tc("delete")}
            onConfirm={() => execute(() => deleteBannerAction({ id: banner.id }), { success: t("deleted") })}
          >
            <Trash className="size-3.5" />
          </ConfirmButton>
        </div>
      </div>
    </div>
  );
}
