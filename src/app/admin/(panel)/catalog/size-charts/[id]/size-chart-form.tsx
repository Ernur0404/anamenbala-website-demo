"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, Trash, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Panel } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/controls";
import { useAdminAction } from "@/components/admin/use-action";
import { deleteSizeChartAction, saveSizeChartAction } from "@/server/actions/admin/catalog";

type Form = { id: string | null; nameRu: string; nameKk: string; noteRu: string; noteKk: string; columns: { ru: string; kk: string }[]; rows: string[][] };

const cell = "h-9 w-full min-w-0 rounded-md border border-line-strong bg-white px-2 text-[13px] outline-none focus:border-sage-500";

export function SizeChartForm({ initial }: { initial: Form }) {
  const t = useTranslations("admin.catalog");
  const tc = useTranslations("admin.common");
  const router = useRouter();
  const { pending, execute } = useAdminAction();
  const [form, setForm] = useState<Form>(initial);

  const setCell = (r: number, c: number, value: string) => setForm((f) => ({ ...f, rows: f.rows.map((row, i) => (i === r ? row.map((x, j) => (j === c ? value : x)) : row)) }));
  const addColumn = () => setForm((f) => ({ ...f, columns: [...f.columns, { ru: "", kk: "" }], rows: f.rows.map((row) => [...row, ""]) }));
  const removeColumn = (c: number) => setForm((f) => ({ ...f, columns: f.columns.filter((_, i) => i !== c), rows: f.rows.map((row) => row.filter((_, i) => i !== c)) }));

  return (
    <div className="space-y-5">
      <Panel>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("chart.nameRu")} required>
            <Input value={form.nameRu} onChange={(e) => setForm((f) => ({ ...f, nameRu: e.target.value }))} maxLength={100} />
          </Field>
          <Field label={t("chart.nameKk")}>
            <Input value={form.nameKk} onChange={(e) => setForm((f) => ({ ...f, nameKk: e.target.value }))} maxLength={100} />
          </Field>
          <Field label={t("chart.noteRu")}>
            <Textarea rows={2} value={form.noteRu} onChange={(e) => setForm((f) => ({ ...f, noteRu: e.target.value }))} maxLength={500} />
          </Field>
          <Field label={t("chart.noteKk")}>
            <Textarea rows={2} value={form.noteKk} onChange={(e) => setForm((f) => ({ ...f, noteKk: e.target.value }))} maxLength={500} />
          </Field>
        </div>
      </Panel>

      <Panel title={t("chart.columns")} padded={false}>
        <div className="overflow-x-auto px-5 pb-5 sm:px-6">
          <table className="w-full min-w-[560px] border-separate border-spacing-1.5">
            <thead>
              <tr>
                {form.columns.map((col, c) => (
                  <th key={c} className="align-top">
                    <div className="space-y-1">
                      <div className="flex gap-1">
                        <input value={col.ru} onChange={(e) => setForm((f) => ({ ...f, columns: f.columns.map((x, i) => (i === c ? { ...x, ru: e.target.value } : x)) }))} placeholder={t("chart.column")} className={`${cell} font-semibold`} aria-label={t("chart.column")} />
                        {form.columns.length > 1 && (
                          <button type="button" onClick={() => removeColumn(c)} className="grid size-9 shrink-0 place-items-center rounded-md text-ink-400 hover:bg-powder-50 hover:text-powder-800" aria-label={tc("remove")}>
                            <X className="size-3.5" />
                          </button>
                        )}
                      </div>
                      <input value={col.kk} onChange={(e) => setForm((f) => ({ ...f, columns: f.columns.map((x, i) => (i === c ? { ...x, kk: e.target.value } : x)) }))} placeholder={t("chart.columnKk")} className={`${cell} text-ink-500`} aria-label={t("chart.columnKk")} />
                    </div>
                  </th>
                ))}
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {form.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((value, c) => (
                    <td key={c}>
                      <input value={value} onChange={(e) => setCell(r, c, e.target.value)} className={cell} aria-label={`${form.columns[c]?.ru ?? ""} ${r + 1}`} />
                    </td>
                  ))}
                  <td>
                    <button type="button" onClick={() => setForm((f) => ({ ...f, rows: f.rows.filter((_, i) => i !== r) }))} className="grid size-9 place-items-center rounded-md text-ink-400 hover:bg-powder-50 hover:text-powder-800" aria-label={tc("remove")}>
                      <Trash className="size-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button variant="soft" size="sm" onClick={() => setForm((f) => ({ ...f, rows: [...f.rows, f.columns.map(() => "")] }))}>
              <Plus />
              {t("chart.addRow")}
            </Button>
            <Button variant="secondary" size="sm" onClick={addColumn} disabled={form.columns.length >= 12}>
              <Plus />
              {t("chart.addColumn")}
            </Button>
          </div>
        </div>
      </Panel>

      <div className="flex flex-wrap justify-end gap-2.5">
        {form.id && (
          <ConfirmButton
            title={`${tc("delete")} «${form.nameRu}»?`}
            text={t("chart.deleteText")}
            confirmLabel={tc("delete")}
            variant="ghost"
            className="text-powder-800"
            onConfirm={() => execute(() => deleteSizeChartAction({ id: form.id! }), { success: t("deleted"), onSuccess: () => router.push("/admin/catalog/size-charts") })}
          >
            {tc("delete")}
          </ConfirmButton>
        )}
        <Button
          loading={pending}
          disabled={!form.nameRu.trim() || !form.columns.some((c) => c.ru.trim())}
          onClick={() =>
            void execute(() => saveSizeChartAction({ ...form, columns: form.columns.map((c) => ({ ru: c.ru, kk: c.kk })) }), {
              success: t("saved"),
              onSuccess: (d) => {
                if (!form.id) router.replace(`/admin/catalog/size-charts/${d.id}`);
              },
            })
          }
        >
          {tc("save")}
        </Button>
      </div>
    </div>
  );
}
