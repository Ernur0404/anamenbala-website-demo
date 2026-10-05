import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getNotifications } from "@/server/notification-feed";
import { PageHero } from "@/components/store/page-hero";
import { NotificationsList } from "@/components/store/notifications-list";
import type { Locale } from "@/lib/l10n";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "notifications" });
  return { title: t("title"), robots: { index: false } };
}

/** Колокольчик в шапке: статусы заказов, акции, новинки и объявления магазина */
export default async function NotificationsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const { items, renderedAt } = await getNotifications(locale as Locale);

  return (
    <>
      <PageHero title={t("notifications.title")} compact breadcrumbs={[{ label: t("common.home"), href: "/" }, { label: t("notifications.title") }]} />
      <div className="container-page mt-4 lg:mt-8">
        <NotificationsList
          items={items}
          renderedAt={renderedAt}
          labels={{
            filters: {
              all: t("notifications.filters.all"),
              order: t("notifications.filters.order"),
              sale: t("notifications.filters.sale"),
              new: t("notifications.filters.new"),
              news: t("notifications.filters.news"),
            },
            empty: t("notifications.empty"),
            emptyText: t("notifications.emptyText"),
            unread: t("notifications.unread"),
          }}
        />
      </div>
    </>
  );
}
