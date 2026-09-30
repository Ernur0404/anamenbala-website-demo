import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireStaff } from "@/server/auth/staff";
import { canSeeFinance } from "@/server/permissions";
import { getProductForEdit, productFormOptions } from "@/server/admin/products";
import { PageHeader } from "@/components/admin/ui";
import { formatDate } from "@/lib/dates";
import { ProductForm } from "../_form/product-form";
import { productToFormState } from "../_form/from-product";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductForEdit(id);
  const t = await getTranslations("admin.products");
  return { title: product?.nameRu ?? t("editTitle") };
}

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff("products");
  const { id } = await params;
  const [product, options] = await Promise.all([getProductForEdit(id), productFormOptions()]);
  if (!product) notFound();
  const t = await getTranslations("admin.products");
  const locale = await getLocale();
  const finance = canSeeFinance(staff.role);
  return (
    <>
      <PageHeader back={{ href: "/admin/products", label: t("title") }} title={product.nameRu} subtitle={t("editTitle")} />
      {/* key: после сохранения форма получает свежие данные с сервера */}
      <ProductForm
        key={product.updatedAt.toISOString()}
        initial={productToFormState(product, finance)}
        options={options}
        finance={finance}
        publishedLabel={product.publishedAt ? t("published", { date: formatDate(product.publishedAt, locale) }) : null}
      />
    </>
  );
}
