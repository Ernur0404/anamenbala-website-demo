import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireStaff } from "@/server/auth/staff";
import { db } from "@/server/db";
import { PageHeader } from "@/components/admin/ui";
import { AttributeForm } from "./attribute-form";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const t = await getTranslations("admin.catalog");
  if (id === "new") return { title: t("attr.new") };
  const a = await db.attribute.findUnique({ where: { id }, select: { nameRu: true } });
  return { title: a?.nameRu ?? t("tabs.attributes") };
}

export default async function AttributePage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff("catalog");
  const { id } = await params;
  const t = await getTranslations("admin.catalog");
  const attribute = id === "new" ? null : await db.attribute.findUnique({ where: { id }, include: { values: { orderBy: { sortOrder: "asc" } } } });
  if (id !== "new" && !attribute) notFound();
  return (
    <>
      <PageHeader back={{ href: "/admin/catalog/attributes", label: t("tabs.attributes") }} title={attribute?.nameRu ?? t("attr.new")} />
      <AttributeForm
        // новые значения получают id на сервере — форма пересоздаётся с актуальными данными
        key={attribute ? `${attribute.id}:${attribute.values.map((v) => v.id).join(".")}` : "new"}
        initial={
          attribute
            ? {
                id: attribute.id,
                code: attribute.code,
                nameRu: attribute.nameRu,
                nameKk: attribute.nameKk ?? "",
                type: attribute.type,
                display: attribute.display,
                isFilterable: attribute.isFilterable,
                isVariantAxis: attribute.isVariantAxis,
                unit: attribute.unit ?? "",
                values: attribute.values.map((v) => ({ key: v.id, id: v.id, valueRu: v.valueRu, valueKk: v.valueKk ?? "", slug: v.slug, colorHex: v.colorHex ?? "" })),
              }
            : { id: null, code: "", nameRu: "", nameKk: "", type: "MULTISELECT", display: "CHECKBOX", isFilterable: true, isVariantAxis: false, unit: "", values: [] }
        }
      />
    </>
  );
}
