"use client";

import { useEffect, useState } from "react";
import { productCardsAction } from "@/server/actions/store";
import type { ProductCardData } from "@/server/catalog/cards";
import { SectionHeading } from "@/components/ui/display";
import { ProductCarousel } from "./product-carousel";

const KEY = "amb_recent";

function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string").slice(0, 12) : [];
  } catch {
    return [];
  }
}

/** Отметить просмотр товара (localStorage — только для удобства, без персональных данных) */
export function TrackRecentlyViewed({ productId }: { productId: string }) {
  useEffect(() => {
    try {
      const next = [productId, ...readRecent().filter((id) => id !== productId)].slice(0, 12);
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // хранилище недоступно — не страшно
    }
  }, [productId]);
  return null;
}

export function RecentlyViewed({ title, excludeId }: { title: string; excludeId?: string }) {
  const [products, setProducts] = useState<ProductCardData[]>([]);
  useEffect(() => {
    const ids = readRecent().filter((id) => id !== excludeId);
    if (!ids.length) return;
    productCardsAction(ids).then((r) => r.ok && setProducts(r.data));
  }, [excludeId]);
  if (products.length < 2) return null;
  return (
    <section className="container-page mt-12 sm:mt-16">
      <SectionHeading title={title} />
      <ProductCarousel products={products} />
    </section>
  );
}
