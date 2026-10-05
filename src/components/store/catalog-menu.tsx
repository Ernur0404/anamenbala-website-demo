"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronRight, Menu, Percent, Phone, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Link, usePathname } from "@/i18n/navigation";
import { DynamicIcon, WhatsAppIcon } from "@/components/ui/icons";
import { LanguageSwitcher } from "./language-switcher";
import { cn } from "@/lib/utils";
import { formatPhone, telLink, whatsappLink } from "@/lib/phone";
import type { MenuCategory } from "./chrome-types";

// ───────────── состояние мобильного меню (общая для шапки и нижней панели) ─────────────

const MenuCtx = createContext<{ open: boolean; setOpen: (v: boolean) => void } | null>(null);

export function MobileMenuProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <MenuCtx.Provider value={{ open, setOpen }}>{children}</MenuCtx.Provider>;
}

export function useMobileMenu() {
  const ctx = useContext(MenuCtx);
  if (!ctx) throw new Error("useMobileMenu вне MobileMenuProvider");
  return ctx;
}

export function MobileMenuButton() {
  const t = useTranslations("nav");
  const { setOpen } = useMobileMenu();
  return (
    <button type="button" onClick={() => setOpen(true)} className="grid size-10 place-items-center rounded-full text-graphite hover:bg-beige-100 lg:hidden" aria-label={t("openMenu")}>
      <Menu className="size-6 stroke-[1.7]" />
    </button>
  );
}

// ───────────── меню категорий в шапке (ПК) ─────────────

export function CategoryNav({ categories }: { categories: MenuCategory[] }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  // меню помнит страницу, на которой его открыли, — после перехода оно само закрыто
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const setOpen = (value: boolean) => setOpenAt(value ? pathname : null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpenAt(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenAt(null);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div ref={panelRef} className="relative hidden lg:block">
      <nav className="container-page flex h-12 items-center gap-9 text-[14.5px] font-medium">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className={cn("flex items-center gap-2.5 font-semibold transition-colors hover:text-sage-700", open && "text-sage-700")}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
          {t("catalog")}
        </button>
        {categories.map((c) => (
          <Link key={c.id} href={c.href} className={cn("transition-colors hover:text-sage-700", isActive(c.href) && "text-powder-700")}>
            {c.name}
          </Link>
        ))}
        <Link href="/sale" className={cn("text-powder-700 transition-colors hover:text-powder-800", isActive("/sale") && "underline underline-offset-8")}>
          {t("sale")}
        </Link>
      </nav>

      {open && (
        <div className="absolute inset-x-0 top-full z-40 border-y border-line bg-white shadow-card animate-fade-in">
          <div className="container-page grid grid-cols-4 gap-8 py-7">
            {categories.map((c) => (
              <div key={c.id}>
                <Link href={c.href} className="group mb-3 flex items-center gap-2.5">
                  <span className="grid size-9 place-items-center rounded-full bg-sage-100 text-sage-700">
                    <DynamicIcon name={c.icon} className="size-[18px]" />
                  </span>
                  <span className="heading-section text-[22px] group-hover:text-sage-700">{c.name}</span>
                </Link>
                <ul className="space-y-1.5 pl-[46px]">
                  {c.children.map((s) => (
                    <li key={s.id}>
                      <Link href={s.href} className="text-sm text-ink-600 transition-colors hover:text-sage-700">
                        {s.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-line bg-cream">
            <div className="container-page flex h-12 items-center gap-6 text-sm font-semibold">
              <Link href="/catalog" className="text-sage-700 hover:underline">
                {t("allProducts")} →
              </Link>
              <Link href="/sale" className="flex items-center gap-1.5 text-powder-700 hover:underline">
                <Percent className="size-4" />
                {t("sale")}
              </Link>
              <span className="ml-auto flex items-center gap-5 text-[13px] font-medium text-ink-500">
                <Link href="/returns" className="hover:text-sage-700">
                  {t("returns")}
                </Link>
                <Link href="/privacy" className="hover:text-sage-700">
                  {t("privacy")}
                </Link>
                <Link href="/offer" className="hover:text-sage-700">
                  {t("offer")}
                </Link>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ───────────── мобильное меню (шторка слева) ─────────────

export function MobileMenu({ categories, contacts, copyright }: { categories: MenuCategory[]; contacts: { phone: string; whatsapp: string }; copyright: string }) {
  const t = useTranslations("nav");
  const { open, setOpen } = useMobileMenu();
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => setOpen(false), [pathname, setOpen]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-graphite/40 data-[state=open]:animate-fade-in lg:hidden" />
        <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 flex w-[min(360px,88vw)] flex-col bg-cream shadow-pop outline-none data-[state=open]:animate-slide-in-left lg:hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <DialogPrimitive.Title className="heading-section text-2xl">{t("catalog")}</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">{t("catalog")}</DialogPrimitive.Description>
            <DialogPrimitive.Close className="grid size-9 place-items-center rounded-full hover:bg-beige-100" aria-label="Закрыть">
              <X className="size-5" />
            </DialogPrimitive.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-2">
            <Link href="/catalog" className="flex items-center gap-3 rounded-lg px-3 py-3 font-semibold hover:bg-beige-50">
              <span className="grid size-9 place-items-center rounded-full bg-sage-700 text-white">
                <DynamicIcon name="grid" className="size-[18px]" />
              </span>
              {t("allProducts")}
            </Link>
            {categories.map((c) => {
              const isOpen = expanded === c.id;
              return (
                <div key={c.id}>
                  <div className="flex items-center">
                    <Link href={c.href} className="flex flex-1 items-center gap-3 rounded-lg px-3 py-2.5 font-medium hover:bg-beige-50">
                      <span className="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-sage-100 text-sage-700">
                        {c.image ? <Image src={c.image.src} alt="" fill sizes="36px" className="object-cover" /> : <DynamicIcon name={c.icon} className="size-[18px]" />}
                      </span>
                      {c.name}
                    </Link>
                    {c.children.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : c.id)}
                        className="grid size-10 place-items-center rounded-full text-ink-500 hover:bg-beige-100"
                        aria-expanded={isOpen}
                        aria-label={c.name}
                      >
                        <ChevronDown className={cn("size-5 transition-transform", isOpen && "rotate-180")} />
                      </button>
                    )}
                  </div>
                  {isOpen && (
                    <ul className="mb-2 ml-[60px] space-y-0.5 border-l border-line pl-3">
                      {c.children.map((s) => (
                        <li key={s.id}>
                          <Link href={s.href} className="flex items-center justify-between rounded-md px-2 py-2 text-sm text-ink-700 hover:bg-beige-50">
                            {s.name}
                            <ChevronRight className="size-4 text-ink-300" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
            <Link href="/sale" className="mt-1 flex items-center gap-3 rounded-lg px-3 py-2.5 font-semibold text-powder-700 hover:bg-powder-50">
              <span className="grid size-9 place-items-center rounded-full bg-powder-100">
                <Percent className="size-[18px]" />
              </span>
              {t("sale")}
            </Link>

            <div className="mx-3 my-3 border-t border-line" />
            {[
              { href: "/about", label: t("about") },
              { href: "/reviews", label: t("reviews") },
              { href: "/delivery", label: t("delivery") },
              { href: "/contacts", label: t("contacts") },
              { href: "/faq", label: t("faq") },
              { href: "/returns", label: t("returns") },
              { href: "/privacy", label: t("privacy") },
              { href: "/offer", label: t("offer") },
            ].map((l) => (
              <Link key={l.href} href={l.href} className="block rounded-md px-3 py-2 text-[15px] text-ink-700 hover:bg-beige-50">
                {l.label}
              </Link>
            ))}
            <p className="px-3 pt-4 pb-2 text-xs text-ink-400">{copyright}</p>
          </div>
          <div className="space-y-3 border-t border-line bg-white px-4 py-4 pb-[max(16px,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-500">{t("language")}</span>
              <LanguageSwitcher />
            </div>
            <div className="flex gap-2">
              <a href={telLink(contacts.phone)} className="flex flex-1 items-center justify-center gap-2 rounded-md border border-line-strong py-2.5 text-sm font-semibold">
                <Phone className="size-4 text-sage-700" />
                {formatPhone(contacts.phone)}
              </a>
              <a href={whatsappLink(contacts.whatsapp)} target="_blank" rel="noopener" className="grid w-12 place-items-center rounded-md bg-[#25d366] text-white" aria-label="WhatsApp">
                <WhatsAppIcon size={20} />
              </a>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
