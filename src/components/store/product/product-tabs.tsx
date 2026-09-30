"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { BadgeCheck, MessageSquareText, PenLine } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { Stars } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import type { ReviewView } from "@/server/catalog/product";
import { ReviewForm } from "./review-form";
import { formatDate } from "@/lib/dates";

export function ProductTabs({
  productId,
  description,
  specs,
  delivery,
  reviews,
  reviewTotal,
  rating,
}: {
  productId: string;
  description: React.ReactNode;
  specs: { label: string; value: string }[];
  delivery: React.ReactNode;
  reviews: ReviewView[];
  reviewTotal: number;
  rating: number;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const [tab, setTab] = useState("description");
  const [writing, setWriting] = useState(false);

  useEffect(() => {
    const onHash = () => window.location.hash === "#reviews" && setTab("reviews");
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <Tabs value={tab} onValueChange={setTab} id="reviews" className="scroll-mt-40 rounded-xl border border-line bg-white px-4 pb-6 sm:px-7">
      <TabsList className="-mx-4 px-2 sm:-mx-7 sm:px-5">
        <TabsTrigger value="description">{t("product.description")}</TabsTrigger>
        <TabsTrigger value="specs">{t("product.specs")}</TabsTrigger>
        <TabsTrigger value="delivery">{t("product.delivery")}</TabsTrigger>
        <TabsTrigger value="reviews">{t("product.reviewsCount", { count: reviewTotal })}</TabsTrigger>
      </TabsList>

      <TabsContent value="description">{description}</TabsContent>

      <TabsContent value="specs">
        {specs.length ? (
          <dl className="grid max-w-2xl gap-x-8 sm:grid-cols-[minmax(160px,auto)_1fr]">
            {specs.map((s) => (
              <div key={s.label} className="contents">
                <dt className="border-b border-dashed border-line py-2.5 text-sm text-ink-500">{s.label}</dt>
                <dd className="border-b border-dashed border-line py-2.5 text-sm font-medium">{s.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-ink-500">{t("product.noSpecs")}</p>
        )}
      </TabsContent>

      <TabsContent value="delivery">{delivery}</TabsContent>

      <TabsContent value="reviews">
        <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
          <div>
            {reviewTotal > 0 ? (
              <div className="rounded-xl bg-cream p-5 text-center">
                <p className="font-serif text-5xl font-semibold">{rating.toFixed(1)}</p>
                <Stars value={rating} className="mt-2 justify-center" />
                <p className="mt-2 text-xs text-ink-500">{t("reviews.basedOn", { count: reviewTotal })}</p>
              </div>
            ) : (
              <div className="rounded-xl bg-cream p-5 text-center">
                <MessageSquareText className="mx-auto size-8 text-sage-600" />
                <p className="mt-2 font-semibold">{t("reviews.empty")}</p>
                <p className="mt-1 text-xs text-ink-500">{t("reviews.emptyText")}</p>
              </div>
            )}
            <Button variant="secondary" block className="mt-3" onClick={() => setWriting((w) => !w)}>
              <PenLine />
              {t("reviews.write")}
            </Button>
          </div>
          <div className="space-y-4">
            {writing && <ReviewForm productId={productId} />}
            {reviews.map((r) => (
              <article key={r.id} className="border-b border-line pb-4 last:border-b-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-semibold">{r.author}</span>
                  <Stars value={r.rating} />
                  <span className="text-xs text-ink-400">{formatDate(r.date, locale)}</span>
                  {r.verified && (
                    <span className="flex items-center gap-1 text-xs font-medium text-sage-700">
                      <BadgeCheck className="size-3.5" />
                      {t("reviews.verified")}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-ink-700">{r.text}</p>
                {r.photos.length > 0 && (
                  <div className="mt-2 flex gap-2">
                    {r.photos.map((p, i) => (
                      <a key={i} href={p.src} target="_blank" rel="noopener" className="relative size-20 overflow-hidden rounded-md bg-beige-50">
                        <Image src={p.src} alt="" fill sizes="80px" className="object-cover" />
                      </a>
                    ))}
                  </div>
                )}
                {r.reply && (
                  <div className="mt-3 rounded-lg bg-sage-50 p-3 text-sm">
                    <p className="mb-1 text-xs font-bold text-sage-800">{t("reviews.reply")}</p>
                    <p className="text-ink-700">{r.reply}</p>
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
