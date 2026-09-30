import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireStaff } from "@/server/auth/staff";
import { db } from "@/server/db";
import { PageHeader } from "@/components/admin/ui";
import { SizeChartForm } from "./size-chart-form";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const t = await getTranslations("admin.catalog");
  if (id === "new") return { title: t("chart.new") };
  const c = await db.sizeChart.findUnique({ where: { id }, select: { nameRu: true } });
  return { title: c?.nameRu ?? t("tabs.sizeCharts") };
}

export default async function SizeChartPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff("catalog");
  const { id } = await params;
  const t = await getTranslations("admin.catalog");
  const chart = id === "new" ? null : await db.sizeChart.findUnique({ where: { id } });
  if (id !== "new" && !chart) notFound();
  const columns = ((chart?.columns as { ru: string; kk?: string }[] | undefined) ?? [{ ru: "Размер" }, { ru: "Рост, см" }, { ru: "Возраст" }]).map((c) => ({ ru: c.ru, kk: c.kk ?? "" }));
  const rows = (chart?.rows as string[][] | undefined) ?? [["", "", ""]];
  return (
    <>
      <PageHeader back={{ href: "/admin/catalog/size-charts", label: t("tabs.sizeCharts") }} title={chart?.nameRu ?? t("chart.new")} />
      <SizeChartForm
        key={chart?.updatedAt.toISOString() ?? "new"}
        initial={{ id: chart?.id ?? null, nameRu: chart?.nameRu ?? "", nameKk: chart?.nameKk ?? "", noteRu: chart?.noteRu ?? "", noteKk: chart?.noteKk ?? "", columns, rows }}
      />
    </>
  );
}
