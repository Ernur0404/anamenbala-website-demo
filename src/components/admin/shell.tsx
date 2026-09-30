"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { DropdownMenu, Dialog as DialogPrimitive } from "radix-ui";
import { Bell, ChevronDown, ExternalLink, Languages, LogOut, Menu, UserRound, X } from "lucide-react";
import { LogoMark } from "@/components/ui/icons";
import { staffLogoutAction } from "@/server/actions/admin/auth";
import { setStaffLocaleAction } from "@/server/actions/admin/profile";
import { ADMIN_NAV, type AdminNavKey } from "./nav";
import { cn } from "@/lib/utils";

export type ShellStaff = { name: string; email: string; role: "OWNER" | "MANAGER"; locale: string };
export type ShellAlert = { key: string; href: string; count: number };

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function Brand({ className }: { className?: string }) {
  const t = useTranslations("admin.common");
  return (
    <Link href="/admin" className={cn("flex items-center gap-2.5", className)}>
      <LogoMark size={36} />
      <span className="leading-none">
        <span className="heading-section block text-[22px] text-graphite">{t("appName")}</span>
        <span className="mt-1 block text-[11.5px] font-medium text-ink-500">{t("panel")}</span>
      </span>
    </Link>
  );
}

function NavList({ allowed, badges, onNavigate }: { allowed: AdminNavKey[]; badges: Partial<Record<AdminNavKey, number>>; onNavigate?: () => void }) {
  const t = useTranslations("admin.nav");
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {ADMIN_NAV.filter((item) => allowed.includes(item.key)).map((item) => {
        const active = isActive(pathname, item.href, item.exact);
        const Icon = item.icon;
        const badge = badges[item.key];
        return (
          <Link
            key={item.key}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-11 items-center gap-3 rounded-[10px] px-3.5 text-[14px] font-medium transition-colors",
              active ? "bg-sage-700 text-white shadow-[0_6px_16px_-8px_rgb(88_126_99/0.8)]" : "text-ink-700 hover:bg-sage-50 hover:text-sage-800",
            )}
          >
            <Icon className="size-[18px] shrink-0 stroke-[1.8]" />
            <span className="min-w-0 flex-1 truncate">{t(item.key)}</span>
            {!!badge && (
              <span className={cn("min-w-5 rounded-full px-1.5 text-center text-[11px] leading-5 font-bold", active ? "bg-white/25 text-white" : "bg-powder-300 text-powder-800")}>{badge > 99 ? "99+" : badge}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarFooter() {
  const t = useTranslations("admin.common");
  const [pending, start] = useTransition();
  return (
    <div className="mt-auto">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => staffLogoutAction())}
        className="flex h-11 w-full items-center gap-3 rounded-[10px] px-3.5 text-[14px] font-medium text-ink-700 transition-colors hover:bg-powder-50 hover:text-powder-800"
      >
        <LogOut className="size-[18px] stroke-[1.8]" />
        {t("logout")}
      </button>
      <div className="mt-4 flex items-center gap-2 border-t border-line pt-4 pl-1">
        <LogoMark size={24} />
        <div className="leading-tight">
          <p className="heading-section text-[15px] text-graphite">{t("appName")}</p>
          <p className="text-[10.5px] text-ink-400">{t("rights", { year: new Date().getFullYear() })}</p>
        </div>
      </div>
    </div>
  );
}

function AlertsMenu({ alerts }: { alerts: ShellAlert[] }) {
  const tc = useTranslations("admin.common");
  const total = alerts.reduce((sum, a) => sum + a.count, 0);
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="relative grid size-10 place-items-center rounded-full text-ink-700 transition-colors hover:bg-sage-50 hover:text-sage-800" aria-label={tc("notifications")}>
        <Bell className="size-[19px] stroke-[1.8]" />
        {total > 0 && <span className="absolute top-1.5 right-1.5 min-w-4 rounded-full bg-powder-600 px-1 text-center text-[10px] leading-4 font-bold text-white">{total > 99 ? "99+" : total}</span>}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className="z-50 w-72 rounded-xl border border-line bg-white p-1.5 shadow-pop animate-fade-in">
          <p className="px-3 pt-2 pb-1.5 text-xs font-semibold tracking-wide text-ink-500 uppercase">{tc("notifications")}</p>
          {alerts.filter((a) => a.count > 0).length === 0 && <p className="px-3 py-4 text-sm text-ink-500">{tc("noNotifications")}</p>}
          {alerts
            .filter((a) => a.count > 0)
            .map((a) => (
              <DropdownMenu.Item key={a.key} asChild>
                <Link href={a.href} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm text-graphite outline-none data-[highlighted]:bg-sage-50">
                  <span>{tc(`alerts.${a.key}`)}</span>
                  <span className="rounded-full bg-powder-100 px-2 py-0.5 text-xs font-bold text-powder-800">{a.count}</span>
                </Link>
              </DropdownMenu.Item>
            ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function UserMenu({ staff }: { staff: ShellStaff }) {
  const t = useTranslations("admin.common");
  const tn = useTranslations("admin.nav");
  const router = useRouter();
  const [pending, start] = useTransition();
  const switchLocale = (locale: "ru" | "kk") =>
    start(async () => {
      await setStaffLocaleAction({ locale });
      router.refresh();
    });
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="flex items-center gap-2.5 rounded-full py-1 pr-2 pl-1 transition-colors hover:bg-sage-50 disabled:opacity-60" disabled={pending}>
        <span className="grid size-9 place-items-center rounded-full bg-sage-700 text-white">
          <UserRound className="size-[18px]" />
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block max-w-40 truncate text-[13px] font-semibold text-graphite">{staff.name}</span>
          <span className="block text-[11.5px] text-ink-500">{staff.role === "OWNER" ? t("owner") : t("manager")}</span>
        </span>
        <ChevronDown className="hidden size-4 text-ink-500 sm:block" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className="z-50 w-64 rounded-xl border border-line bg-white p-1.5 shadow-pop animate-fade-in">
          <div className="px-3 pt-2 pb-2.5">
            <p className="truncate text-sm font-semibold text-graphite">{staff.name}</p>
            <p className="truncate text-xs text-ink-500">{staff.email}</p>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item asChild>
            <Link href="/admin/profile" className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-graphite outline-none data-[highlighted]:bg-sage-50">
              <UserRound className="size-4 text-ink-500" />
              {tn("profile")}
            </Link>
          </DropdownMenu.Item>
          <div className="flex items-center gap-2.5 px-3 py-2 text-sm text-graphite">
            <Languages className="size-4 text-ink-500" />
            <span className="flex-1">{t("language")}</span>
            <span className="flex rounded-full bg-cream-200 p-0.5 text-xs font-semibold">
              {(["ru", "kk"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => switchLocale(l)}
                  className={cn("rounded-full px-2.5 py-1 transition-colors", staff.locale === l ? "bg-white text-sage-800 shadow-soft" : "text-ink-500 hover:text-graphite")}
                >
                  {l === "ru" ? t("ruShort") : t("kkShort")}
                </button>
              ))}
            </span>
          </div>
          <DropdownMenu.Item asChild>
            <a href="/" target="_blank" rel="noreferrer" className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-graphite outline-none data-[highlighted]:bg-sage-50">
              <ExternalLink className="size-4 text-ink-500" />
              {t("openSite")}
            </a>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item
            onSelect={() => start(() => staffLogoutAction())}
            className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-powder-800 outline-none data-[highlighted]:bg-powder-50"
          >
            <LogOut className="size-4" />
            {t("logout")}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function AdminShell({
  staff,
  allowed,
  alerts,
  badges,
  children,
}: {
  staff: ShellStaff;
  allowed: AdminNavKey[];
  alerts: ShellAlert[];
  badges: Partial<Record<AdminNavKey, number>>;
  children: ReactNode;
}) {
  const t = useTranslations("admin.common");
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-[#f6f5f0]">
      <header className="sticky top-0 z-40 flex h-16 items-center border-b border-line bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="flex h-full items-center gap-2 px-3 lg:w-[248px] lg:shrink-0 lg:border-r lg:border-line lg:px-5">
          <button type="button" onClick={() => setMenuOpen(true)} className="grid size-10 place-items-center rounded-full text-graphite hover:bg-sage-50 lg:hidden" aria-label={t("menu")}>
            <Menu className="size-5" />
          </button>
          <Brand />
        </div>
        <div className="ml-auto flex items-center gap-1.5 px-3 sm:gap-3 lg:px-6">
          <AlertsMenu alerts={alerts} />
          <span className="hidden h-7 w-px bg-line sm:block" />
          <UserMenu staff={staff} />
        </div>
      </header>

      <div className="lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] flex-col overflow-y-auto border-r border-line bg-[#fbfaf7] px-4 py-5 lg:flex">
          <NavList allowed={allowed} badges={badges} />
          <SidebarFooter />
        </aside>
        <main className="min-w-0 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">{children}</main>
      </div>

      {/* меню на телефоне */}
      <DialogPrimitive.Root open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-graphite/40 data-[state=open]:animate-fade-in lg:hidden" />
          <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 flex w-[86vw] max-w-[300px] flex-col overflow-y-auto bg-[#fbfaf7] px-4 py-4 shadow-pop outline-none data-[state=open]:animate-slide-in-left lg:hidden" aria-describedby={undefined}>
            <DialogPrimitive.Title className="sr-only">{t("menu")}</DialogPrimitive.Title>
            <div className="mb-5 flex items-center justify-between">
              <Brand />
              <DialogPrimitive.Close className="grid size-9 place-items-center rounded-full hover:bg-sage-50" aria-label={t("close")}>
                <X className="size-5" />
              </DialogPrimitive.Close>
            </div>
            <NavList allowed={allowed} badges={badges} onNavigate={() => setMenuOpen(false)} />
            <SidebarFooter />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  );
}
