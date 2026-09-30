"use client";

import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useAdminAction } from "@/components/admin/use-action";
import { moveAttributeAction, moveBadgeAction, moveBrandAction } from "@/server/actions/admin/catalog";

const ACTIONS = { attribute: moveAttributeAction, brand: moveBrandAction, badge: moveBadgeAction } as const;
const btn = "grid size-8 place-items-center rounded-md border border-line bg-white text-ink-600 hover:border-sage-400 hover:text-sage-700 disabled:opacity-30";

/** Кнопки «выше / ниже» для порядка в списках справочников */
export function SortButtons({ kind, id, first, last }: { kind: keyof typeof ACTIONS; id: string; first: boolean; last: boolean }) {
  const t = useTranslations("admin.catalog");
  const { pending, execute } = useAdminAction();
  const move = (direction: "up" | "down") => execute(() => ACTIONS[kind]({ id, direction }), { success: false });
  return (
    <div className="inline-flex gap-1.5">
      <button type="button" className={btn} disabled={first || pending} onClick={() => void move("up")} aria-label={t("moveUp")}>
        <ArrowUp className="size-3.5" />
      </button>
      <button type="button" className={btn} disabled={last || pending} onClick={() => void move("down")} aria-label={t("moveDown")}>
        <ArrowDown className="size-3.5" />
      </button>
    </div>
  );
}
