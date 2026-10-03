"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ProductCardData } from "@/server/catalog/cards";
import { ProductCard } from "./product-card";
import { cn } from "@/lib/utils";

/** Горизонтальная лента карточек: свайп на телефоне, стрелки на компьютере */
export function ProductCarousel({ products, perRow = 5, mobilePerView = 2, className }: { products: ProductCardData[]; perRow?: 4 | 5; mobilePerView?: 2 | 3; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.9, behavior: "smooth" });
  const width = perRow === 5 ? "lg:w-[calc((100%-4*16px)/5)]" : "lg:w-[calc((100%-3*16px)/4)]";

  return (
    <div className={cn("group/carousel relative", className)}>
      <div ref={ref} className={cn("scrollbar-none -mx-4 flex snap-x snap-mandatory overflow-x-auto scroll-px-4 px-4 pb-1 sm:gap-4 lg:mx-0 lg:scroll-px-0 lg:px-0", mobilePerView === 3 ? "gap-2.5" : "gap-3")}>
        {products.map((p) => (
          <div key={p.id} className={cn("shrink-0 snap-start sm:w-[31%] md:w-[calc((100%-3*16px)/4)]", mobilePerView === 3 ? "w-[calc((100%-2*10px)/3)]" : "w-[calc((100%-12px)/2)]", width)}>
            <ProductCard product={p} compact={mobilePerView === 3} />
          </div>
        ))}
      </div>
      {products.length > perRow && (
        <>
          <button
            type="button"
            onClick={() => scroll(-1)}
            className="absolute top-[38%] -left-4 hidden size-10 place-items-center rounded-full border border-line bg-white shadow-card transition-opacity hover:text-sage-700 lg:grid"
            aria-label="Назад"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => scroll(1)}
            className="absolute top-[38%] -right-4 hidden size-10 place-items-center rounded-full border border-line bg-white shadow-card transition-opacity hover:text-sage-700 lg:grid"
            aria-label="Вперёд"
          >
            <ChevronRight className="size-5" />
          </button>
        </>
      )}
    </div>
  );
}
