import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Compass } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default async function AdminNotFound() {
  const t = await getTranslations("admin.common");
  return (
    <div className="mx-auto mt-10 max-w-md rounded-2xl border border-line bg-white p-8 text-center shadow-soft">
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-sage-50 text-sage-700">
        <Compass className="size-7" />
      </span>
      <h1 className="heading-section mt-4 text-[28px]">{t("notFoundTitle")}</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-600">{t("notFoundText")}</p>
      <Link href="/admin" className={buttonVariants({ className: "mt-6" })}>
        {t("toDashboard")}
      </Link>
    </div>
  );
}
