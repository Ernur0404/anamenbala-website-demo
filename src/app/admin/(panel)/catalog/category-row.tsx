"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus } from "lucide-react";
import { Switch, Tooltip } from "@/components/ui/primitives";
import { StatusPill } from "@/components/ui/display";
import { DynamicIcon } from "@/components/ui/icons";
import { Thumb } from "@/components/admin/ui";
import { useAdminAction } from "@/components/admin/use-action";
import { moveCategoryAction, toggleCategoryAction } from "@/server/actions/admin/catalog";
import { cn } from "@/lib/utils";

export type CategoryRowData = {
  id: string;
  parentId: string | null;
  name: string;
  nameKk: string | null;
  slug: string;
  icon: string | null;
  isVisible: boolean;
  showInMenu: boolean;
  imageUrl: string | null;
  products: number;
  first: boolean;
  last: boolean;
};

const iconBtn = "grid size-8 place-items-center rounded-md border border-line bg-white text-ink-600 transition-colors hover:border-sage-400 hover:text-sage-700 disabled:opacity-30 disabled:hover:border-line disabled:hover:text-ink-600";

export function CategoryRow({ data, nested }: { data: CategoryRowData; nested?: boolean }) {
  const t = useTranslations("admin.catalog");
  const { pending, execute } = useAdminAction();
  return (
    <div className={cn("flex flex-wrap items-center gap-3 px-5 py-3 sm:px-6", nested && "pl-10 sm:pl-14")}>
      <Thumb src={data.imageUrl} size={nested ? 38 : 46} className="rounded-lg" />
      {!nested && data.icon && (
        <span className="hidden size-8 place-items-center rounded-full bg-sage-50 text-sage-700 sm:grid">
          <DynamicIcon name={data.icon} size={16} />
        </span>
      )}
      <div className="min-w-40 flex-1">
        <Link href={`/admin/catalog/categories/${data.id}`} className={cn("font-semibold text-graphite hover:text-sage-700", nested ? "text-[14px]" : "text-[15px]")}>
          {data.name}
        </Link>
        <p className="text-[12px] text-ink-500">
          /{data.slug} · {t("productsCount", { count: data.products })}
          {data.nameKk && <span className="text-ink-400"> · {data.nameKk}</span>}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {!data.isVisible && <StatusPill tone="beige">{t("hiddenBadge")}</StatusPill>}
        {data.isVisible && !data.showInMenu && <StatusPill tone="gray">{t("notInMenu")}</StatusPill>}
        <Tooltip content={t("fields.isVisible")}>
          <span className="flex items-center gap-1.5 text-ink-400">
            {data.isVisible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
            <Switch
              checked={data.isVisible}
              disabled={pending}
              onCheckedChange={(value) => void execute(() => toggleCategoryAction({ id: data.id, field: "isVisible", value }), { success: t("saved") })}
              aria-label={t("fields.isVisible")}
            />
          </span>
        </Tooltip>
        <Tooltip content={t("fields.showInMenu")}>
          <span>
            <Switch
              checked={data.showInMenu}
              disabled={pending || !data.isVisible}
              onCheckedChange={(value) => void execute(() => toggleCategoryAction({ id: data.id, field: "showInMenu", value }), { success: t("saved") })}
              aria-label={t("fields.showInMenu")}
            />
          </span>
        </Tooltip>
        <button type="button" className={iconBtn} disabled={data.first || pending} onClick={() => void execute(() => moveCategoryAction({ id: data.id, direction: "up" }), { success: false })} aria-label={t("moveUp")}>
          <ArrowUp className="size-3.5" />
        </button>
        <button type="button" className={iconBtn} disabled={data.last || pending} onClick={() => void execute(() => moveCategoryAction({ id: data.id, direction: "down" }), { success: false })} aria-label={t("moveDown")}>
          <ArrowDown className="size-3.5" />
        </button>
        {!nested && (
          <Link href={`/admin/catalog/categories/new?parent=${data.id}`} className={cn(iconBtn, "w-auto gap-1 px-2.5 text-[12.5px] font-semibold")} title={t("addSubcategory")}>
            <Plus className="size-3.5" />
            <span className="hidden md:inline">{t("addSubcategory")}</span>
          </Link>
        )}
        <Link href={`/admin/catalog/categories/${data.id}`} className={iconBtn} aria-label={t("editCategory", { name: data.name })}>
          <Pencil className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}
