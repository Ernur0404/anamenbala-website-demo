"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Search, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { usePathname } from "@/i18n/navigation";
import { SearchBox } from "./search-box";
import { cn } from "@/lib/utils";

/** Поиск на телефоне: значок в шапке открывает строку поиска с подсказками поверх страницы */
export function MobileSearchButton() {
  const t = useTranslations("search");
  const tc = useTranslations("common");
  const pathname = usePathname();
  // панель помнит страницу, на которой её открыли: после перехода к товару или результатам она закрыта
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(value) => setOpenAt(value ? pathname : null)}>
      <DialogPrimitive.Trigger className={cn("grid size-10 place-items-center rounded-full text-graphite hover:bg-beige-100", pathname === "/" && "max-sm:hidden")} aria-label={t("label")}>
        <Search className="size-[22px] stroke-[1.7]" />
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-graphite/40 data-[state=open]:animate-fade-in lg:hidden" />
        <DialogPrimitive.Content className="fixed inset-x-0 top-0 z-50 border-b border-line bg-cream px-4 pt-[max(12px,env(safe-area-inset-top))] pb-4 shadow-pop outline-none data-[state=open]:animate-fade-in lg:hidden">
          <DialogPrimitive.Title className="sr-only">{t("label")}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">{t("placeholder")}</DialogPrimitive.Description>
          <div className="flex items-center gap-2">
            <SearchBox className="min-w-0 flex-1" autoFocus onNavigate={() => setOpenAt(null)} />
            <DialogPrimitive.Close className="grid size-10 shrink-0 place-items-center rounded-full text-ink-600 hover:bg-beige-100" aria-label={tc("close")}>
              <X className="size-5" />
            </DialogPrimitive.Close>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
