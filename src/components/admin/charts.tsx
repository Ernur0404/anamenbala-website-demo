"use client";

import { useLocale, useTranslations } from "next-intl";
import { Area, AreaChart, CartesianGrid, Cell, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ComposedChart } from "recharts";
import { formatMoney } from "@/lib/money";

const SAGE = "#587e63";
const SAGE_LIGHT = "#abc7b3";
const PALETTE = ["#587e63", "#95b89f", "#c5ab85", "#e8b8b8", "#dac8ab", "#abc7b3", "#bb6f6f"];

/** Короткие суммы на оси графика: «1,5 млн», «250 тыс» / «250 мың» */
function shortMoney(v: number, locale: string) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1).replace(".0", "").replace(".", ",")} млн`;
  if (v >= 1000) return `${Math.round(v / 1000)} ${locale === "kk" ? "мың" : "тыс"}`;
  return String(v);
}

function dateLabel(key: string, bucket: "day" | "week" | "month", locale: string) {
  const d = new Date(`${key}T12:00:00Z`);
  const loc = locale === "kk" ? "kk-KZ" : "ru-RU";
  if (bucket === "month") return new Intl.DateTimeFormat(loc, { month: "short", year: "2-digit", timeZone: "UTC" }).format(d);
  return new Intl.DateTimeFormat(loc, { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(d);
}

/** «Динамика продаж»: выручка (заливка) и количество заказов (линия), как в макете */
export function SalesChart({ points, bucket, height = 280 }: { points: { key: string; revenue: number; orders: number }[]; bucket: "day" | "week" | "month"; height?: number }) {
  const t = useTranslations("admin.dashboard");
  const locale = useLocale();
  const data = points.map((p) => ({ ...p, label: dateLabel(p.key, bucket, locale) }));
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SAGE} stopOpacity={0.28} />
              <stop offset="100%" stopColor={SAGE} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#ebe5da" strokeDasharray="0" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#737974" }} minTickGap={16} />
          <YAxis yAxisId="revenue" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#737974" }} tickFormatter={(v: number) => shortMoney(v, locale)} width={56} />
          <YAxis yAxisId="orders" orientation="right" hide allowDecimals={false} />
          <Tooltip
            contentStyle={{ borderRadius: 10, border: "1px solid #ebe5da", boxShadow: "0 12px 32px -14px rgb(47 52 48 / 0.3)", fontSize: 12 }}
            formatter={(value, name) => (name === "revenue" ? [formatMoney(Number(value)), t("revenue")] : [String(value), t("ordersCount")])}
          />
          <Area yAxisId="revenue" type="monotone" dataKey="revenue" stroke={SAGE} strokeWidth={2.2} fill="url(#revenueFill)" dot={{ r: 3, fill: SAGE, strokeWidth: 0 }} activeDot={{ r: 5 }} />
          <Line yAxisId="orders" type="monotone" dataKey="orders" stroke={SAGE_LIGHT} strokeWidth={1.8} dot={{ r: 2.5, fill: SAGE_LIGHT, strokeWidth: 0 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Маленький график выручки для отчётов */
export function MiniArea({ points }: { points: { key: string; revenue: number }[] }) {
  return (
    <div className="h-16 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <Area type="monotone" dataKey="revenue" stroke={SAGE} strokeWidth={1.8} fill={SAGE} fillOpacity={0.12} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Кольцевая диаграмма «Статистика категорий» */
export function DonutChart({ items, centerValue, centerLabel }: { items: { name: string; value: number }[]; centerValue: string; centerLabel: string }) {
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <div className="relative size-40 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={items} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="100%" paddingAngle={1.5} stroke="none" isAnimationActive={false}>
              {items.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-[20px] leading-none font-bold text-graphite">{centerValue}</p>
            <p className="mt-1 text-[11px] text-ink-500">{centerLabel}</p>
          </div>
        </div>
      </div>
      <ul className="w-full space-y-2">
        {items.map((item, i) => (
          <li key={item.name} className="flex items-center gap-2.5 text-[13px]">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className="min-w-0 flex-1 truncate text-ink-700">{item.name}</span>
            <span className="font-semibold text-graphite">{Math.round((item.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
