import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export async function PromoNav({ active }: { active: "promotions" | "codes" }) {
  const t = await getTranslations("admin.promotions");
  return (
    <>
      <nav className="mb-4 inline-flex gap-1 rounded-full border border-line bg-white p-1">
        {(["promotions", "codes"] as const).map((key) => (
          <Link
            key={key}
            href={key === "promotions" ? "/admin/promotions" : "/admin/promotions/codes"}
            aria-current={active === key ? "page" : undefined}
            className={cn("rounded-full px-4 py-2 text-[13px] font-semibold transition-colors", active === key ? "bg-sage-700 text-white" : "text-ink-700 hover:text-sage-800")}
          >
            {t(`tabs.${key}`)}
          </Link>
        ))}
      </nav>
      <p className="mb-5 flex max-w-3xl items-start gap-2 rounded-xl bg-sage-50 px-4 py-3 text-[13px] leading-relaxed text-sage-900">
        <Info className="mt-0.5 size-4 shrink-0 text-sage-700" />
        {t("howItWorks")}
      </p>
    </>
  );
}
