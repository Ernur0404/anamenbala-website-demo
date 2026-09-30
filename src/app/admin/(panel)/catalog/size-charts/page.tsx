import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { requireStaff } from "@/server/auth/staff";
import { db } from "@/server/db";
import { PageHeader, Panel } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { CatalogNav } from "../catalog-nav";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.catalog");
  return { title: t("tabs.sizeCharts") };
}

export default async function SizeChartsPage() {
  await requireStaff("catalog");
  const t = await getTranslations("admin.catalog");
  const charts = await db.sizeChart.findMany({ orderBy: { nameRu: "asc" }, include: { _count: { select: { categories: true, products: true } } } });
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <CatalogNav
        active="sizeCharts"
        actions={
          <Link href="/admin/catalog/size-charts/new" className={buttonVariants({ size: "sm" })}>
            <Plus />
            {t("chart.add")}
          </Link>
        }
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {charts.map((c) => {
          const columns = (c.columns as { ru: string }[]) ?? [];
          const rows = (c.rows as string[][]) ?? [];
          return (
            <Link key={c.id} href={`/admin/catalog/size-charts/${c.id}`} className="block transition-shadow hover:shadow-card">
              <Panel title={c.nameRu} subtitle={`${t("chart.rows", { count: rows.length })} · ${t("chart.usedBy", { count: c._count.categories + c._count.products })}`}>
                <div className="overflow-hidden rounded-lg border border-line">
                  <table className="w-full text-[12px]">
                    <thead className="bg-cream/70">
                      <tr>
                        {columns.slice(0, 5).map((col, i) => (
                          <th key={i} className="px-2 py-1.5 text-left font-semibold text-ink-600">
                            {col.ru}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 3).map((row, i) => (
                        <tr key={i} className="border-t border-line">
                          {row.slice(0, 5).map((cell, j) => (
                            <td key={j} className="px-2 py-1.5 text-ink-700">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </Link>
          );
        })}
      </div>
    </>
  );
}
