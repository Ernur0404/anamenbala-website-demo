import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BadgeCheck } from "lucide-react";
import { db } from "@/server/db";
import { mediaSelect } from "@/server/media/refs";
import { toImage } from "@/server/catalog/cards";
import { PageHero } from "@/components/store/page-hero";
import { ReviewForm } from "@/components/store/product/review-form";
import { Stars } from "@/components/ui/display";
import { Pagination } from "@/components/store/catalog/pagination";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/dates";
import { tr, type Locale } from "@/lib/l10n";

export const metadata: Metadata = { title: "Отзывы" };

const PER_PAGE = 12;

export default async function ReviewsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale: raw } = await params;
  setRequestLocale(raw);
  const locale = raw as Locale;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const t = await getTranslations();

  const where = { status: "APPROVED" as const };
  const [reviews, total, agg] = await Promise.all([
    db.review.findMany({
      where,
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: { product: { select: { slug: true, nameRu: true, nameKk: true } }, photos: { orderBy: { sortOrder: "asc" }, include: { media: { select: mediaSelect } } } },
    }),
    db.review.count({ where }),
    db.review.aggregate({ where, _avg: { rating: true } }),
  ]);

  return (
    <>
      <PageHero title={t("reviews.storeTitle")} compact breadcrumbs={[{ label: t("common.home"), href: "/" }, { label: t("reviews.title") }]}>
        {total > 0 && (
          <p className="mt-3 flex items-center gap-2 text-sm text-ink-600">
            <Stars value={agg._avg.rating ?? 0} />
            <span className="font-semibold text-graphite">{(agg._avg.rating ?? 0).toFixed(1)}</span>· {t("reviews.basedOn", { count: total })}
          </p>
        )}
      </PageHero>
      <div className="container-page mt-4 grid gap-8 lg:mt-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          {reviews.length === 0 && <p className="rounded-xl border border-dashed border-line-strong bg-white/60 p-8 text-center text-ink-500">{t("reviews.storeEmpty")}</p>}
          {reviews.map((r) => (
            <article key={r.id} className="rounded-xl border border-line bg-white p-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="grid size-9 place-items-center rounded-full bg-sage-100 font-serif text-lg font-semibold text-sage-800">{r.authorName.slice(0, 1).toUpperCase()}</span>
                <span className="font-semibold">{r.authorName}</span>
                <Stars value={r.rating} />
                <span className="text-xs text-ink-400">{formatDate(r.createdAt, locale)}</span>
                {r.isVerified && (
                  <span className="flex items-center gap-1 text-xs font-medium text-sage-700">
                    <BadgeCheck className="size-3.5" />
                    {t("reviews.verified")}
                  </span>
                )}
              </div>
              {r.product && (
                <Link href={`/product/${r.product.slug}`} className="mt-2 inline-block text-xs font-semibold text-sage-700 hover:underline">
                  {t("reviews.aboutProduct", { name: tr(r.product, "name", locale) })}
                </Link>
              )}
              <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-ink-700">{r.text}</p>
              {r.photos.length > 0 && (
                <div className="mt-3 flex gap-2">
                  {r.photos.map((p) => {
                    const img = toImage(p.media, r.authorName);
                    return img ? (
                      <a key={p.mediaId} href={img.src} target="_blank" rel="noopener" className="relative size-20 overflow-hidden rounded-md bg-beige-50">
                        <Image src={img.src} alt="" fill sizes="80px" className="object-cover" />
                      </a>
                    ) : null;
                  })}
                </div>
              )}
              {r.replyText && (
                <div className="mt-3 rounded-lg bg-sage-50 p-3 text-sm">
                  <p className="mb-1 text-xs font-bold text-sage-800">{t("reviews.reply")}</p>
                  <p className="text-ink-700">{r.replyText}</p>
                </div>
              )}
            </article>
          ))}
          <Pagination page={page} pages={Math.max(1, Math.ceil(total / PER_PAGE))} searchParams={sp} />
        </div>
        <aside id="write" className="scroll-mt-40 lg:sticky lg:top-[150px] lg:h-fit">
          <h2 className="heading-section mb-3 text-[26px]">{t("reviews.leaveStore")}</h2>
          <ReviewForm />
        </aside>
      </div>
    </>
  );
}
