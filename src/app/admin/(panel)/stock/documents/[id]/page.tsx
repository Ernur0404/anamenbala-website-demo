import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireStaff } from "@/server/auth/staff";
import { canSeeFinance } from "@/server/permissions";
import { getStockDocument, variantLabel } from "@/server/admin/stock";
import { PageHeader } from "@/components/admin/ui";
import { StatusPill } from "@/components/ui/display";
import { formatDateTime } from "@/lib/dates";
import { mediaUrl } from "@/lib/media-url";
import { StockDocumentEditor } from "../document-editor";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const t = await getTranslations("admin.stock");
  const doc = id === "new" ? null : await getStockDocument(id);
  return { title: doc ? t("docTitle", { type: t(`docType.${doc.type}`), number: doc.number }) : t("title") };
}

export default async function StockDocumentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ type?: string }> }) {
  const staff = await requireStaff("stock");
  const { id } = await params;
  const t = await getTranslations("admin.stock");
  const locale = await getLocale();
  const finance = canSeeFinance(staff.role);

  if (id === "new") {
    const { type: rawType } = await searchParams;
    const type = rawType === "WRITE_OFF" || rawType === "ADJUSTMENT" ? rawType : "RECEIPT";
    return (
      <>
        <PageHeader back={{ href: "/admin/stock/documents", label: t("backToDocuments") }} title={t("newDocTitle", { type: t(`docType.${type}`) })} subtitle={t(`docTypeHint.${type}`)} />
        <StockDocumentEditor doc={{ id: null, type, status: "DRAFT", supplier: "", note: "", lines: [] }} finance={finance} />
      </>
    );
  }

  const doc = await getStockDocument(id);
  if (!doc) notFound();
  return (
    <>
      <PageHeader
        back={{ href: "/admin/stock/documents", label: t("backToDocuments") }}
        title={t("docTitle", { type: t(`docType.${doc.type}`), number: doc.number })}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <StatusPill tone={doc.status === "POSTED" ? "sage" : "gray"}>{t(`docStatus.${doc.status}`)}</StatusPill>
            {doc.status === "POSTED"
              ? t("readOnly", { date: formatDateTime(doc.postedAt, locale), who: doc.postedBy?.name ?? "—" })
              : t(`docTypeHint.${doc.type}`)}
          </span>
        }
      />
      <StockDocumentEditor
        key={doc.updatedAt.toISOString()}
        finance={finance}
        doc={{
          id: doc.id,
          type: doc.type,
          status: doc.status,
          supplier: doc.supplier ?? "",
          note: doc.note ?? "",
          lines: doc.lines.map((l) => ({
            variantId: l.variantId,
            name: l.variant.product.nameRu,
            label: variantLabel(l.variant) || null,
            sku: l.variant.sku,
            imageUrl: mediaUrl(l.variant.product.media[0]?.media, 320),
            current: l.variant.stock,
            quantity: l.quantity,
            costPrice: finance ? l.costPrice : null,
          })),
        }}
      />
    </>
  );
}
