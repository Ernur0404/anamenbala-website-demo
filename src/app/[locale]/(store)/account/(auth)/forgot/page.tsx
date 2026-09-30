import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ForgotForm } from "@/components/store/account/auth-forms";

export const metadata: Metadata = { title: "Восстановление пароля", robots: { index: false } };

export default async function ForgotPage() {
  const t = await getTranslations("account");
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-line bg-white p-6 shadow-soft sm:p-8">
      <h1 className="heading-section text-3xl">{t("forgotTitle")}</h1>
      <p className="mt-2 mb-6 text-sm text-ink-500">{t("forgotText")}</p>
      <ForgotForm />
    </div>
  );
}
