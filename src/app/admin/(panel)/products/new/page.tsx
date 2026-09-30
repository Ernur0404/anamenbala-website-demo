import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireStaff } from "@/server/auth/staff";
import { canSeeFinance } from "@/server/permissions";
import { productFormOptions } from "@/server/admin/products";
import { PageHeader } from "@/components/admin/ui";
import { ProductForm } from "../_form/product-form";
import { emptyProductState } from "../_form/state";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.products");
  return { title: t("newTitle") };
}

export default async function NewProductPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const staff = await requireStaff("products");
  const t = await getTranslations("admin.products");
  const { category } = await searchParams;
  const options = await productFormOptions();
  const initial = emptyProductState();
  if (category && options.categories.some((c) => c.id === category)) initial.categoryIds = [category];
  return (
    <>
      <PageHeader back={{ href: "/admin/products", label: t("title") }} title={t("newTitle")} />
      <ProductForm initial={initial} options={options} finance={canSeeFinance(staff.role)} />
    </>
  );
}
