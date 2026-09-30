import { getSetting, type Tone } from "../settings";
import { pickLocale } from "@/lib/l10n";
import type { OrderStatus, PaymentStatus } from "@/generated/prisma/enums";

export type StatusView = { label: string; tone: Tone };
export type StatusLabels = { order: Record<OrderStatus, StatusView>; payment: Record<PaymentStatus, StatusView> };

/** Названия и цвета статусов из настроек (владелец меняет их в «Настройки → Статусы») */
export async function getStatusLabels(locale: string): Promise<StatusLabels> {
  const s = await getSetting("statuses");
  const map = <K extends string>(src: Record<K, { ru: string; kk: string; tone: Tone }>) =>
    Object.fromEntries(Object.entries(src).map(([k, v]) => [k, { label: pickLocale(v as { ru: string; kk: string }, locale), tone: (v as { tone: Tone }).tone }])) as Record<K, StatusView>;
  return { order: map(s.order), payment: map(s.payment) };
}
