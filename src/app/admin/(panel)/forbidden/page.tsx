import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ShieldAlert } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default async function ForbiddenPage() {
  const t = await getTranslations("admin.auth");
  return (
    <div className="mx-auto mt-10 max-w-md rounded-2xl border border-line bg-white p-8 text-center shadow-soft">
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-powder-100 text-powder-700">
        <ShieldAlert className="size-7" />
      </span>
      <h1 className="heading-section mt-4 text-[28px]">{t("forbiddenTitle")}</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-600">{t("forbiddenText")}</p>
      <Link href="/admin" className={buttonVariants({ className: "mt-6" })}>
        {t("toDashboard")}
      </Link>
    </div>
  );
}
