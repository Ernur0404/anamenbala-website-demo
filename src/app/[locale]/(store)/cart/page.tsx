import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ShoppingBag } from "lucide-react";
import { getCartView } from "@/server/cart-view";
import { getSectionProducts } from "@/server/content";
import { Breadcrumbs } from "@/components/store/breadcrumbs";
import { CartClient } from "@/components/store/cart/cart-client";
import { ProductsSection } from "@/components/store/home/sections";
import { EmptyState } from "@/components/ui/display";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/lib/l10n";

export const metadata: Metadata = { title: "Корзина", robots: { index: false } };

export default async function CartPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  setRequestLocale(raw);
  const locale = raw as Locale;
  const t = await getTranslations();
  const [cart, popular] = await Promise.all([getCartView(locale), getSectionProducts({ source: "popular", limit: 10 }, locale)]);
  const inCart = new Set(cart?.lines.map((l) => l.productId) ?? []);
  const suggestions = popular.filter((p) => !inCart.has(p.id)).slice(0, 8);

  return (
    <>
      <div className="container-page pt-4 sm:pt-6">
        <Breadcrumbs items={[{ label: t("common.home"), href: "/" }, { label: t("cart.title") }]} className="mb-3" />
        <h1 className="heading-display mb-6 text-[40px] sm:text-[52px]">{t("cart.title")}</h1>
        {cart ? (
          <CartClient cart={cart} />
        ) : (
          <EmptyState
            icon={<ShoppingBag />}
            title={t("cart.empty")}
            text={t("cart.emptyText")}
            action={
              <Link href="/catalog" className="inline-flex h-11 items-center rounded-lg bg-sage-700 px-5 text-sm font-semibold text-white hover:bg-sage-800">
                {t("cart.goShopping")}
              </Link>
            }
          />
        )}
      </div>
      <ProductsSection title={t("cart.mayLike")} href="/catalog" products={suggestions} viewAll={t("common.viewAll")} />
    </>
  );
}
