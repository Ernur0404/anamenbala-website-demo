import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { requireStaff } from "@/server/auth/staff";
import { listReviews, REVIEW_PAGE_SIZE } from "@/server/admin/reviews";
import { FilterPills, PageHeader, Pagination, Panel } from "@/components/admin/ui";
import { ParamSelect, SearchInput } from "@/components/admin/controls";
import { param, pageParam, withParams, type SearchParams } from "@/components/admin/url";
import { formatDateTime } from "@/lib/dates";
import { mediaUrl } from "@/lib/media-url";
import { AddReviewButton, ReviewCard, type ReviewCardData } from "./review-card";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.reviews");
  return { title: t("title") };
}

const STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireStaff("reviews");
  const sp = await searchParams;
  const t = await getTranslations("admin.reviews");
  const tc = await getTranslations("admin.common");
  const locale = await getLocale();
  const statusParam = param(sp, "status");
  // по умолчанию — очередь модерации
  const status = statusParam === "ALL" ? undefined : (STATUSES.find((s) => s === statusParam) ?? "PENDING");
  const rating = Number(param(sp, "rating")) || undefined;
  const page = pageParam(sp);
  const { rows, total, counts } = await listReviews({ status, q: param(sp, "q"), rating }, page);
  const path = "/admin/reviews";
  const all = Object.values(counts).reduce((s, n) => s + n, 0);

  const data: ReviewCardData[] = rows.map((r) => ({
    id: r.id,
    authorName: r.authorName,
    rating: r.rating,
    text: r.text,
    status: r.status,
    source: r.source,
    isVerified: r.isVerified,
    isFeatured: r.isFeatured,
    replyText: r.replyText ?? "",
    date: formatDateTime(r.createdAt, locale),
    product: r.product ? { id: r.product.id, name: r.product.nameRu, slug: r.product.slug, imageUrl: mediaUrl(r.product.media[0]?.media, 320) } : null,
    photos: r.photos.map((p) => ({ id: p.mediaId, url: mediaUrl(p.media, 640), thumb: mediaUrl(p.media, 320) })),
    moderatedBy: r.moderatedBy?.name ?? null,
  }));

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} actions={<AddReviewButton />} />
      <Panel padded={false}>
        <div className="flex flex-col gap-3 px-5 pt-5 pb-4 sm:px-6 lg:flex-row lg:items-center">
          <FilterPills
            items={[
              ...STATUSES.map((s) => ({ key: s, label: t(`tabs.${s}`), href: withParams(path, sp, { status: s === "PENDING" ? null : s, page: null }), active: status === s, count: counts[s] ?? 0 })),
              { key: "ALL", label: t("tabs.ALL"), href: withParams(path, sp, { status: "ALL", page: null }), active: !status, count: all },
            ]}
          />
          <div className="flex gap-3 lg:ml-auto">
            <SearchInput className="w-full lg:w-64" placeholder={t("searchPlaceholder")} />
            <ParamSelect className="w-40 shrink-0" param="rating" allLabel={t("allRatings")} options={[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: "★".repeat(n) }))} />
          </div>
        </div>
        {data.length === 0 ? (
          <p className="border-t border-line px-6 py-14 text-center text-sm text-ink-500">{status === "PENDING" ? t("emptyPending") : t("empty")}</p>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {data.map((r) => (
              <li key={r.id}>
                <ReviewCard review={r} />
              </li>
            ))}
          </ul>
        )}
        <Pagination path={path} searchParams={sp} page={page} pageSize={REVIEW_PAGE_SIZE} total={total} shownLabel={(from, to, n) => tc("shown", { from, to, total: n })} />
      </Panel>
    </>
  );
}
