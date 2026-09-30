import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { requireStaff } from "@/server/auth/staff";
import { db } from "@/server/db";
import { DataTable, PageHeader, Panel, Td, Th, Tr } from "@/components/admin/ui";
import { StatusPill } from "@/components/ui/display";
import { buttonVariants } from "@/components/ui/button";
import { CatalogNav } from "../catalog-nav";
import { SortButtons } from "../sort-buttons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.catalog");
  return { title: t("tabs.attributes") };
}

export default async function AttributesPage() {
  await requireStaff("catalog");
  const t = await getTranslations("admin.catalog");
  const attributes = await db.attribute.findMany({
    orderBy: [{ sortOrder: "asc" }, { nameRu: "asc" }],
    include: { values: { orderBy: { sortOrder: "asc" }, take: 8, select: { valueRu: true, colorHex: true } }, _count: { select: { values: true, categories: true } } },
  });
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <CatalogNav
        active="attributes"
        actions={
          <Link href="/admin/catalog/attributes/new" className={buttonVariants({ size: "sm" })}>
            <Plus />
            {t("attr.add")}
          </Link>
        }
      />
      <Panel padded={false}>
        <DataTable minWidth={760}>
          <thead className="bg-cream/60">
            <tr>
              <Th>{t("fields.nameRu")}</Th>
              <Th>{t("attr.values")}</Th>
              <Th>{t("attr.type")}</Th>
              <Th />
              <Th align="right" />
            </tr>
          </thead>
          <tbody>
            {attributes.map((a, i) => (
              <Tr key={a.id}>
                <Td>
                  <Link href={`/admin/catalog/attributes/${a.id}`} className="font-semibold text-graphite hover:text-sage-700">
                    {a.nameRu}
                  </Link>
                  <p className="text-[12px] text-ink-400">
                    {a.code}
                    {a.unit ? ` · ${a.unit}` : ""}
                  </p>
                </Td>
                <Td>
                  <div className="flex max-w-md flex-wrap items-center gap-1.5">
                    {a.values.map((v) => (
                      <span key={v.valueRu} className="inline-flex items-center gap-1 rounded-full bg-cream-200 px-2 py-0.5 text-[12px] text-ink-700">
                        {v.colorHex && <span className="size-2.5 rounded-full border border-black/10" style={{ background: v.colorHex }} />}
                        {v.valueRu}
                      </span>
                    ))}
                    {a._count.values > a.values.length && <span className="text-[12px] text-ink-400">+{a._count.values - a.values.length}</span>}
                  </div>
                </Td>
                <Td className="text-ink-600">{t(`attr.types.${a.type}`)}</Td>
                <Td>
                  <div className="flex flex-wrap gap-1.5">
                    {a.isVariantAxis && <StatusPill tone="lavender">{t("attr.variantAxis")}</StatusPill>}
                    {a.isFilterable && <StatusPill tone="sage">{t("attr.filter")}</StatusPill>}
                  </div>
                </Td>
                <Td align="right">
                  <SortButtons kind="attribute" id={a.id} first={i === 0} last={i === attributes.length - 1} />
                </Td>
              </Tr>
            ))}
          </tbody>
        </DataTable>
      </Panel>
    </>
  );
}
