import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/server/auth/customer";
import { redirect } from "@/i18n/navigation";
import { getPageHero } from "@/server/content";
import { PageHero } from "@/components/store/page-hero";
import type { Locale } from "@/lib/l10n";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const locale = (await getLocale()) as Locale;
  if (await getCurrentUser()) redirect({ href: "/account", locale });
  const [t, hero] = await Promise.all([getTranslations(), getPageHero("account", locale)]);
  return (
    <>
      <PageHero title={hero?.title ?? t("account.title")} subtitle={hero?.subtitle} image={hero?.image} compact breadcrumbs={[{ label: t("common.home"), href: "/" }, { label: t("account.title") }]} />
      <div className="container-page mt-8">{children}</div>
    </>
  );
}
