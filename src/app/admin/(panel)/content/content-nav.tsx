import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";

export type ContentTab = "home" | "categories" | "pages" | "faq" | "news" | "instagram" | "header";

const TABS: { key: ContentTab; href: string }[] = [
  { key: "home", href: "/admin/content" },
  { key: "categories", href: "/admin/content/categories" },
  { key: "pages", href: "/admin/content/pages" },
  { key: "faq", href: "/admin/content/faq" },
  { key: "news", href: "/admin/content/news" },
  { key: "instagram", href: "/admin/content/instagram" },
  { key: "header", href: "/admin/content/header" },
];

/** Вкладки как в макете «Баннеры / Контент» */
export async function ContentNav({ active }: { active: ContentTab }) {
  const t = await getTranslations("admin.content");
  return (
    <nav className="scrollbar-none mb-5 flex max-w-full gap-1 overflow-x-auto rounded-xl border border-line bg-white p-1">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={active === tab.key ? "page" : undefined}
          className={cn(
            "shrink-0 rounded-lg px-4 py-2.5 text-[13px] font-semibold whitespace-nowrap transition-colors sm:flex-1 sm:text-center",
            active === tab.key ? "bg-sage-700 text-white shadow-[0_6px_16px_-10px_rgb(88_126_99/0.9)]" : "text-ink-700 hover:bg-sage-50 hover:text-sage-800",
          )}
        >
          {t(`tabs.${tab.key}`)}
        </Link>
      ))}
    </nav>
  );
}
