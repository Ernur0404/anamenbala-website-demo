import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { MailWarning } from "lucide-react";
import { getCurrentUser } from "@/server/auth/customer";
import { redirect } from "@/i18n/navigation";
import { getPageHero } from "@/server/content";
import { PageHero } from "@/components/store/page-hero";
import { AccountNav } from "@/components/store/account/account-nav";
import { ResendVerification } from "@/components/store/account/account-forms";
import type { Locale } from "@/lib/l10n";

export default async function CabinetLayout({ children }: { children: ReactNode }) {
  const locale = (await getLocale()) as Locale;
  const user = await getCurrentUser();
  if (!user) return redirect({ href: "/account/login", locale });
  const [t, hero] = await Promise.all([getTranslations(), getPageHero("account", locale)]);
  return (
    <>
      <PageHero
        title={hero?.title ?? t("account.title")}
        subtitle={t("account.welcome", { name: user.name })}
        image={hero?.image}
        compact
        breadcrumbs={[{ label: t("common.home"), href: "/" }, { label: t("account.title") }]}
      />
      <div className="container-page mt-6 grid gap-6 lg:grid-cols-[240px_1fr] lg:gap-8">
        <AccountNav labels={{ orders: t("account.orders"), addresses: t("account.addresses"), profile: t("account.profile"), favorites: t("account.favorites"), logout: t("account.logout") }} />
        <div className="min-w-0">
          {!user.emailVerifiedAt && (
            <p className="mb-5 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
              <MailWarning className="size-4" />
              {t("account.verifyBanner", { email: user.email })} · <ResendVerification />
            </p>
          )}
          {children}
        </div>
      </div>
    </>
  );
}
