import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ResetForm } from "@/components/store/account/auth-forms";
import { Link } from "@/i18n/navigation";

export const metadata: Metadata = { title: "Новый пароль", robots: { index: false } };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const t = await getTranslations("account");
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-line bg-white p-6 shadow-soft sm:p-8">
      <h1 className="heading-section mb-6 text-3xl">{t("resetTitle")}</h1>
      {token ? (
        <ResetForm token={token} />
      ) : (
        <p className="text-sm text-ink-600">
          {t("resetInvalid")}{" "}
          <Link href="/account/forgot" className="font-semibold text-sage-700 underline">
            {t("forgot")}
          </Link>
        </p>
      )}
    </div>
  );
}
