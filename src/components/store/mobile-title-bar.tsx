"use client";

import { useEffect, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Breadcrumbs, type Crumb } from "./breadcrumbs";

// История переходов внутри сайта: «назад» уводит на предыдущую страницу магазина,
// а если её нет (зашли по ссылке) — на родительский раздел, а не прочь с сайта
const stack: string[] = [];

export function NavigationHistory() {
  const pathname = usePathname();
  useEffect(() => {
    if (stack.at(-1) === pathname) return;
    if (stack.at(-2) === pathname) stack.pop();
    else stack.push(pathname);
  }, [pathname]);
  return null;
}

function useBack(backHref: string) {
  const router = useRouter();
  return () => (stack.length > 1 ? router.back() : router.push(backHref));
}

/** Хлебные крошки со стрелкой «назад» в одну строку (страница товара на телефоне) */
export function MobileCrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  const t = useTranslations("common");
  const back = useBack(items.at(-1)?.href ?? "/");
  return (
    <div className={cn("flex items-center gap-1 lg:hidden", className)}>
      <button type="button" onClick={back} className="-ml-2 grid size-9 shrink-0 place-items-center rounded-full text-graphite hover:bg-beige-100" aria-label={t("back")}>
        <ArrowLeft className="size-5 stroke-[1.8]" />
      </button>
      <Breadcrumbs items={items} linkLast className="scrollbar-none min-w-0 overflow-x-auto [&_ol]:flex-nowrap [&_ol]:whitespace-nowrap" />
    </div>
  );
}

/** Строка «← Заголовок» вверху внутренних страниц на телефоне (как в мобильном макете) */
export function MobileTitleBar({ title, backHref = "/", className, children }: { title: string; backHref?: string; className?: string; children?: ReactNode }) {
  const t = useTranslations("common");
  const back = useBack(backHref);
  return (
    <div className={cn("container-page flex items-center gap-1.5 pt-3 pb-1 lg:hidden", className)}>
      <button
        type="button"
        onClick={back}
        className="-ml-2 grid size-10 shrink-0 place-items-center rounded-full text-graphite transition-colors hover:bg-beige-100"
        aria-label={t("back")}
      >
        <ArrowLeft className="size-[22px] stroke-[1.8]" />
      </button>
      <h1 className="min-w-0 flex-1 truncate text-[19px] font-bold text-graphite">{title}</h1>
      {children}
    </div>
  );
}
