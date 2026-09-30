import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { db } from "@/server/db";
import { cn } from "@/lib/utils";

export async function CustomersNav({ active, actions }: { active: "customers" | "messages" | "subscribers"; actions?: React.ReactNode }) {
  const t = await getTranslations("admin.customers");
  const newMessages = await db.contactMessage.count({ where: { status: "NEW" } });
  const tabs = [
    { key: "customers", href: "/admin/customers" },
    { key: "messages", href: "/admin/customers/messages" },
    { key: "subscribers", href: "/admin/customers/subscribers" },
  ] as const;
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <nav className="scrollbar-none flex max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-white p-1">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active === tab.key ? "page" : undefined}
            className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold whitespace-nowrap transition-colors", active === tab.key ? "bg-sage-700 text-white" : "text-ink-700 hover:text-sage-800")}
          >
            {t(`tabs.${tab.key}`)}
            {tab.key === "messages" && newMessages > 0 && <span className="rounded-full bg-powder-300 px-1.5 text-[11px] leading-[18px] text-powder-800">{newMessages}</span>}
          </Link>
        ))}
      </nav>
      {actions}
    </div>
  );
}
