"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { StatusPill, type Tone } from "@/components/ui/display";
import { DataTable, Panel, Td, Th, Tr } from "@/components/admin/ui";
import { useAdminAction } from "@/components/admin/use-action";
import { saveStatusesAction } from "@/server/actions/admin/settings";

type Label = { ru: string; kk: string; tone: Tone };
type Statuses = { order: Record<string, Label>; payment: Record<string, Label> };

const TONES: Tone[] = ["sage", "amber", "sky", "powder", "lavender", "graphite", "gray", "beige"];

export function StatusesForm({ initial }: { initial: Statuses }) {
  const t = useTranslations("admin.settings.statuses");
  const ts = useTranslations("admin.settings");
  const tc = useTranslations("admin.common");
  const { pending, execute } = useAdminAction();
  const [form, setForm] = useState(initial);

  const set = (group: keyof Statuses, key: string, patch: Partial<Label>) => setForm({ ...form, [group]: { ...form[group], [key]: { ...form[group][key], ...patch } } });

  const table = (group: keyof Statuses) => (
    <DataTable minWidth={640}>
      <thead>
        <tr>
          <Th className="w-44">{tc("status")}</Th>
          <Th>{t("label")}</Th>
          <Th>{t("labelKk")}</Th>
          <Th className="w-44">{t("tone")}</Th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(form[group]).map(([key, label]) => (
          <Tr key={key}>
            <Td>
              <StatusPill tone={label.tone} dot>
                {label.ru || key}
              </StatusPill>
            </Td>
            <Td>
              <Input value={label.ru} onChange={(e) => set(group, key, { ru: e.target.value })} maxLength={40} aria-label={`${t("label")} ${key}`} className="h-10" />
            </Td>
            <Td>
              <Input value={label.kk} onChange={(e) => set(group, key, { kk: e.target.value })} maxLength={40} aria-label={`${t("labelKk")} ${key}`} className="h-10" />
            </Td>
            <Td>
              <Select value={label.tone} onChange={(e) => set(group, key, { tone: e.target.value as Tone })} aria-label={`${t("tone")} ${key}`} className="h-10 text-[13px]">
                {TONES.map((tone) => (
                  <option key={tone} value={tone}>
                    {t(`tones.${tone}`)}
                  </option>
                ))}
              </Select>
            </Td>
          </Tr>
        ))}
      </tbody>
    </DataTable>
  );

  const empty = [...Object.values(form.order), ...Object.values(form.payment)].some((l) => !l.ru.trim());

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        void execute(() => saveStatusesAction(form), { success: ts("saved") });
      }}
    >
      <p className="rounded-lg bg-beige-50 px-4 py-3 text-[13px] leading-relaxed text-ink-600">{t("hint")}</p>
      <Panel title={t("order")} serif padded={false}>
        {table("order")}
      </Panel>
      <Panel title={t("payment")} serif padded={false}>
        {table("payment")}
      </Panel>
      <Button type="submit" loading={pending} disabled={empty}>
        {tc("save")}
      </Button>
    </form>
  );
}
