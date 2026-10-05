import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getStoreChrome } from "@/server/store-chrome";
import { getCartCount, getFavoriteIds } from "@/server/store-session";
import { getCurrentUser } from "@/server/auth/customer";
import { getUnreadNotificationCount } from "@/server/notification-feed";
import { StoreProvider } from "@/components/store/store-provider";
import { TopBar } from "@/components/store/top-bar";
import { Logo } from "@/components/store/logo";
import { SearchBox } from "@/components/store/search-box";
import { HeaderActions, MobileAccountButton, MobileNotificationsButton } from "@/components/store/header-actions";
import { MobileSearchButton } from "@/components/store/mobile-search";
import { NavigationHistory } from "@/components/store/mobile-title-bar";
import { CategoryNav, MobileMenu, MobileMenuButton, MobileMenuProvider } from "@/components/store/catalog-menu";
import { BottomNav } from "@/components/store/bottom-nav";
import { Footer } from "@/components/store/footer";
import type { Locale } from "@/lib/l10n";

export default async function StoreLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, chrome, cartCount, favorites, user, notificationCount] = await Promise.all([
    getTranslations("footer"),
    getStoreChrome(locale as Locale),
    getCartCount(),
    getFavoriteIds(),
    getCurrentUser(),
    getUnreadNotificationCount(),
  ]);

  return (
    <StoreProvider initialCartCount={cartCount} initialFavorites={favorites} initialNotificationCount={notificationCount}>
      <MobileMenuProvider>
        <div className="flex min-h-dvh flex-col">
          <NavigationHistory />
          <TopBar items={chrome.topbar} className="hidden lg:block" />
          <header className="sticky top-0 z-40 border-b border-line/80 bg-cream/95 backdrop-blur supports-[backdrop-filter]:bg-cream/85">
            <div className="container-page flex h-14 items-center gap-1 lg:h-[84px] lg:gap-10">
              <MobileMenuButton />
              <Logo name={chrome.storeName} tagline={chrome.tagline} size="sm" className="ml-0.5 lg:hidden" />
              <Logo name={chrome.storeName} tagline={chrome.tagline} className="hidden lg:flex" />
              <SearchBox className="mx-auto hidden max-w-[560px] flex-1 lg:block" />
              <div className="ml-auto hidden lg:block">
                <HeaderActions userName={user?.name ?? null} />
              </div>
              <div className="-mr-1.5 ml-auto flex items-center lg:hidden">
                <MobileSearchButton />
                <MobileAccountButton />
                <MobileNotificationsButton />
              </div>
            </div>
            <CategoryNav categories={chrome.menu} />
          </header>

          <main className="flex-1 pb-24 lg:pb-0">{children}</main>

          <Footer storeName={chrome.storeName} tagline={chrome.tagline} categories={chrome.menu} contacts={chrome.contacts} extraPages={chrome.footerPages} />
          <div className="h-16 lg:hidden" aria-hidden />
          <BottomNav />
          <MobileMenu
            categories={chrome.menu}
            contacts={{ phone: chrome.contacts.phone, whatsapp: chrome.contacts.whatsapp }}
            copyright={t("rights", { year: new Date().getFullYear() })}
          />
        </div>
      </MobileMenuProvider>
    </StoreProvider>
  );
}
