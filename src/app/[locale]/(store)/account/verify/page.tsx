import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CircleCheck, CircleX } from "lucide-react";
import { verifyEmail } from "@/server/auth/customer";
import { Link } from "@/i18n/navigation";

export const metadata: Metadata = { title: "Подтверждение email", robots: { index: false } };

export default async function VerifyPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ token?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { token } = await searchParams;
  const t = await getTranslations("account");
  const ok = token ? await verifyEmail(token) : false;
  return (
    <div className="container-page py-14">
      <div className="mx-auto max-w-md rounded-2xl border border-line bg-white p-8 text-center shadow-soft">
        {ok ? <CircleCheck className="mx-auto size-12 text-sage-700" /> : <CircleX className="mx-auto size-12 text-powder-600" />}
        <h1 className="heading-section mt-4 text-3xl">{t("verifyTitle")}</h1>
        <p className="mt-2 text-sm text-ink-600">{ok ? t("verified") : t("verifyFailed")}</p>
        <Link href="/account" className="mt-6 inline-flex h-11 items-center rounded-lg bg-sage-700 px-5 text-sm font-semibold text-white hover:bg-sage-800">
          {t("title")}
        </Link>
      </div>
    </div>
  );
}
