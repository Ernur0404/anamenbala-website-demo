import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireStaff } from "@/server/auth/staff";
import { db } from "@/server/db";
import { mediaSelect, type MediaRef } from "@/server/media/refs";
import { PageHeader } from "@/components/admin/ui";
import { mediaUrl } from "@/lib/media-url";
import { saleDateKeys } from "../../../products/_form/state";
import { BannerForm } from "./banner-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.content.banners");
  return { title: t("edit") };
}

export default async function BannerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ placement?: string }> }) {
  await requireStaff("content");
  const { id } = await params;
  const { placement } = await searchParams;
  const t = await getTranslations("admin.content");
  const banner = id === "new" ? null : await db.banner.findUnique({ where: { id }, include: { image: { select: mediaSelect }, mobileImage: { select: mediaSelect } } });
  if (id !== "new" && !banner) notFound();
  const img = (m: MediaRef | null) => (m ? { id: m.id, url: mediaUrl(m, 960) } : null);
  const dates = saleDateKeys(banner?.startsAt ?? null, banner?.endsAt ?? null);

  return (
    <>
      <PageHeader back={{ href: "/admin/content", label: t("title") }} title={banner?.titleRu ?? t("banners.new")} />
      <BannerForm
        key={banner?.updatedAt.toISOString() ?? "new"}
        initial={{
          id: banner?.id ?? null,
          placement: banner?.placement ?? (placement === "HOME_PROMO" ? "HOME_PROMO" : "HOME_HERO"),
          eyebrowRu: banner?.eyebrowRu ?? "",
          eyebrowKk: banner?.eyebrowKk ?? "",
          titleRu: banner?.titleRu ?? "",
          titleKk: banner?.titleKk ?? "",
          textRu: banner?.textRu ?? "",
          textKk: banner?.textKk ?? "",
          scriptRu: banner?.scriptRu ?? "",
          scriptKk: banner?.scriptKk ?? "",
          buttonTextRu: banner?.buttonTextRu ?? "",
          buttonTextKk: banner?.buttonTextKk ?? "",
          url: banner?.url ?? "",
          image: img(banner?.image ?? null),
          mobileImage: img(banner?.mobileImage ?? null),
          features: ((banner?.features as { icon: string; ru: string; kk?: string }[] | undefined) ?? []).map((f) => ({ icon: f.icon, ru: f.ru, kk: f.kk ?? "" })),
          startsAt: dates.start,
          endsAt: dates.end,
          isActive: banner?.isActive ?? true,
        }}
      />
    </>
  );
}
