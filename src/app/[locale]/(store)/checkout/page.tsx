import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ShoppingBag } from "lucide-react";
import { db } from "@/server/db";
import { getCartView } from "@/server/cart-view";
import { getDeliveryMethods, getPageHero, getPaymentMethods } from "@/server/content";
import { getCurrentUser } from "@/server/auth/customer";
import { getSetting } from "@/server/settings";
import { PageHero } from "@/components/store/page-hero";
import { CheckoutForm, type CheckoutDelivery, type CheckoutPayment } from "@/components/store/checkout/checkout-form";
import { EmptyState } from "@/components/ui/display";
import { Link } from "@/i18n/navigation";
import { pickLocale, tr, trOrNull, type Locale } from "@/lib/l10n";

export const metadata: Metadata = { title: "Оформление заказа", robots: { index: false } };

export default async function CheckoutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  setRequestLocale(raw);
  const locale = raw as Locale;
  const t = await getTranslations();
  const [cart, hero, deliveryRows, paymentRows, user, contacts] = await Promise.all([
    getCartView(locale),
    getPageHero("checkout", locale),
    getDeliveryMethods(),
    getPaymentMethods(),
    getCurrentUser(),
    getSetting("contacts"),
  ]);

  const address = user ? await db.address.findFirst({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] }) : null;

  const deliveries: CheckoutDelivery[] = deliveryRows.map((d) => ({
    id: d.id,
    kind: d.kind,
    name: tr(d, "name", locale),
    description: trOrNull(d, "description", locale),
    eta: trOrNull(d, "eta", locale),
    price: d.price,
    freeFrom: d.freeFrom,
    address: trOrNull(d, "address", locale),
    paymentIds: d.paymentMethods.map((p) => p.paymentMethodId),
  }));
  const payments: CheckoutPayment[] = paymentRows.map((p) => ({ id: p.id, kind: p.kind, name: tr(p, "name", locale), description: trOrNull(p, "description", locale) }));

  return (
    <>
      <PageHero
        title={hero?.title ?? t("checkout.title")}
        subtitle={hero?.subtitle}
        script={hero?.script}
        image={hero?.image}
        compact
        breadcrumbs={[{ label: t("common.home"), href: "/" }, { label: t("cart.title"), href: "/cart" }, { label: hero?.title ?? t("checkout.title") }]}
      />
      <div className="container-page mt-3 lg:mt-8">
        {cart && deliveries.length ? (
          <CheckoutForm
            cart={cart}
            deliveries={deliveries}
            payments={payments}
            hours={pickLocale(contacts.hours, locale)}
            isLoggedIn={Boolean(user)}
            defaults={{
              name: user?.name ?? "",
              phone: user?.phone ?? "",
              email: user?.email ?? "",
              region: address?.region ?? "",
              city: address?.city ?? "",
              street: address?.street ?? "",
              house: address?.house ?? "",
              apartment: address?.apartment ?? "",
              postalCode: address?.postalCode ?? "",
            }}
          />
        ) : (
          <EmptyState
            icon={<ShoppingBag />}
            title={t("checkout.emptyCart")}
            text={t("cart.emptyText")}
            action={
              <Link href="/catalog" className="inline-flex h-11 items-center rounded-lg bg-sage-700 px-5 text-sm font-semibold text-white hover:bg-sage-800">
                {t("cart.goShopping")}
              </Link>
            }
          />
        )}
      </div>
    </>
  );
}
