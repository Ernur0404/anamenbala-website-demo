import type { ReactNode } from "react";
import { Panel } from "@/components/admin/ui";
import { formatMoney } from "@/lib/money";

/** Таблица «название — заказы — выручка — доля» для разбивок отчётов */
export function ShareTable({ title, rows, labels, empty }: { title: string; rows: { label: ReactNode; orders?: number; revenue: number; extra?: ReactNode }[]; labels: { name: string; orders: string; revenue: string; share: string }; empty: string }) {
  const total = rows.reduce((s, r) => s + r.revenue, 0) || 1;
  return (
    <Panel title={title} padded={false}>
      {rows.length === 0 ? (
        <p className="px-6 pb-6 text-sm text-ink-500">{empty}</p>
      ) : (
        <table className="w-full text-[13px]">
          <thead className="bg-cream/60 text-left text-[12px] text-ink-500">
            <tr>
              <th className="py-2.5 pl-5 font-semibold sm:pl-6">{labels.name}</th>
              {rows.some((r) => r.orders != null) && <th className="px-2 py-2.5 text-right font-semibold">{labels.orders}</th>}
              <th className="px-2 py-2.5 text-right font-semibold">{labels.revenue}</th>
              <th className="w-40 py-2.5 pr-5 pl-2 font-semibold sm:pr-6">{labels.share}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const share = Math.round((r.revenue / total) * 100);
              return (
                <tr key={i} className="border-t border-line">
                  <td className="py-2.5 pl-5 text-graphite sm:pl-6">{r.label}</td>
                  {r.orders != null && <td className="px-2 text-right text-ink-600">{r.orders}</td>}
                  <td className="px-2 text-right font-semibold whitespace-nowrap">{formatMoney(r.revenue)}</td>
                  <td className="py-2.5 pr-5 pl-2 sm:pr-6">
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                        <span className="block h-full rounded-full bg-sage-600" style={{ width: `${share}%` }} />
                      </span>
                      <span className="w-9 text-right text-[12px] text-ink-500">{share}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
