import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PackageMinus, PackagePlus, ClipboardCheck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Вкладки раздела «Склад» и кнопки новых документов */
export async function StockNav({ active }: { active: "balances" | "documents" | "movements" }) {
  const t = await getTranslations("admin.stock");
  const tabs = [
    { key: "balances", href: "/admin/stock" },
    { key: "documents", href: "/admin/stock/documents" },
    { key: "movements", href: "/admin/stock/movements" },
  ] as const;
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <nav className="flex gap-1 rounded-full border border-line bg-white p-1">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active === tab.key ? "page" : undefined}
            className={cn("rounded-full px-4 py-2 text-[13px] font-semibold transition-colors", active === tab.key ? "bg-sage-700 text-white" : "text-ink-700 hover:text-sage-800")}
          >
            {t(`tabs.${tab.key}`)}
          </Link>
        ))}
      </nav>
      <div className="flex flex-wrap gap-2">
        <Link href="/admin/stock/documents/new?type=RECEIPT" className={buttonVariants({ size: "sm" })}>
          <PackagePlus />
          {t("newReceipt")}
        </Link>
        <Link href="/admin/stock/documents/new?type=WRITE_OFF" className={buttonVariants({ size: "sm", variant: "secondary" })}>
          <PackageMinus />
          {t("newWriteOff")}
        </Link>
        <Link href="/admin/stock/documents/new?type=ADJUSTMENT" className={buttonVariants({ size: "sm", variant: "secondary" })}>
          <ClipboardCheck />
          {t("newAdjustment")}
        </Link>
      </div>
    </div>
  );
}
