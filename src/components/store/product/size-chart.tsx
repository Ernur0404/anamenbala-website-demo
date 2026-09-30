"use client";

import { useTranslations } from "next-intl";
import { Ruler } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/primitives";
import type { SizeChartView } from "@/server/catalog/product";

export function SizeChartDialog({ chart }: { chart: SizeChartView }) {
  const t = useTranslations("product");
  return (
    <Dialog>
      <DialogTrigger className="flex items-center gap-1.5 text-[13px] font-semibold text-sage-700 underline-offset-4 hover:underline">
        <Ruler className="size-4" />
        {t("sizeChart")}
      </DialogTrigger>
      <DialogContent title={chart.name} description={chart.note ?? undefined} size="lg">
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-sm">
            <thead className="bg-beige-50 text-left">
              <tr>
                {chart.columns.map((c) => (
                  <th key={c} className="px-3 py-2.5 font-semibold whitespace-nowrap">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {chart.rows.map((row, i) => (
                <tr key={i} className="border-t border-line odd:bg-white even:bg-cream">
                  {row.map((cell, j) => (
                    <td key={j} className={j === 0 ? "px-3 py-2 font-semibold" : "px-3 py-2 text-ink-600"}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
