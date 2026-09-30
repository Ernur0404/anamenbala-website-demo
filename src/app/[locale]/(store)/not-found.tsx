import { getTranslations } from "next-intl/server";
import { Compass } from "lucide-react";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations();
  return (
    <div className="container-page py-16 sm:py-24">
      <div className="mx-auto max-w-lg text-center">
        <span className="mx-auto grid size-20 place-items-center rounded-full bg-sage-100 text-sage-700">
          <Compass className="size-9" />
        </span>
        <p className="heading-display mt-6 text-[72px] leading-none text-sage-300">404</p>
        <h1 className="heading-section mt-2 text-[34px]">{t("notFound.title")}</h1>
        <p className="mt-3 text-ink-600">{t("notFound.text")}</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/" className="inline-flex h-11 items-center justify-center rounded-lg border border-line-strong bg-white px-5 text-sm font-semibold hover:border-sage-500">
            {t("common.goHome")}
          </Link>
          <Link href="/catalog" className="inline-flex h-11 items-center justify-center rounded-lg bg-sage-700 px-5 text-sm font-semibold text-white hover:bg-sage-800">
            {t("notFound.catalog")}
          </Link>
        </div>
      </div>
    </div>
  );
}
