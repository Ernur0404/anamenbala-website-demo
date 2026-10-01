"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CalendarRange, Download, FileSpreadsheet, TriangleAlert, Upload } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Panel } from "@/components/admin/ui";
import { useAdminAction } from "@/components/admin/use-action";
import { applyImportAction, previewImportAction } from "@/server/actions/admin/settings";

/** Выгрузка заказов за выбранный период */
export function ExportOrders({ defaultFrom, defaultTo }: { defaultFrom: string; defaultTo: string }) {
  const t = useTranslations("admin.settings.data");
  const tc = useTranslations("admin.common");
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const valid = Boolean(from && to && from <= to);
  const href = `/api/admin/export/orders?${new URLSearchParams({ from, to }).toString()}`;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-line px-4 py-3.5">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-sage-50 text-sage-700">
        <CalendarRange className="size-5" />
      </span>
      <span className="text-[14px] font-semibold text-graphite">{t("exportOrders")}</span>
      <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
        <span className="text-[13px] text-ink-500">{tc("from")}</span>
        <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-10 w-40" aria-label={tc("from")} />
        <span className="text-[13px] text-ink-500">{tc("to")}</span>
        <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="h-10 w-40" aria-label={tc("to")} />
        {valid ? (
          <a href={href} download className={buttonVariants({ size: "sm" })}>
            <Download />
            {t("download")}
          </a>
        ) : (
          <Button size="sm" disabled>
            <Download />
            {t("download")}
          </Button>
        )}
      </div>
    </div>
  );
}

type Plan = { rows: number; updates: number; creates: number; errors: { row: number; message: string }[] };

/** Импорт товаров: выбор файла → проверка → применение */
export function ImportProducts() {
  const t = useTranslations("admin.settings.data");
  const { pending, execute } = useAdminAction();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);

  const form = (f: File) => {
    const data = new FormData();
    data.set("file", f);
    return data;
  };

  const check = (f: File) => {
    setFile(f);
    setPlan(null);
    void execute(() => previewImportAction(form(f)), { success: false, onSuccess: setPlan });
  };

  const apply = () => {
    if (!file) return;
    void execute(() => applyImportAction(form(file)), {
      success: false,
      onSuccess: (r) => {
        toast.success(t("applied", { updated: r.updated, created: r.created }));
        setFile(null);
        setPlan(null);
        if (input.current) input.current.value = "";
      },
    });
  };

  const canApply = Boolean(plan && plan.errors.length === 0 && plan.updates + plan.creates > 0);

  return (
    <Panel title={t("import")} subtitle={t("importHint")} serif>
      <div className="space-y-4">
        <p className="rounded-lg bg-beige-50 px-4 py-3 text-[13px] leading-relaxed text-ink-600">{t("rules")}</p>
        <p className="flex items-start gap-2 text-[13px] text-amber-800">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {t("backupNote")}
        </p>
        <div className="flex flex-wrap gap-2.5">
          <a href="/api/admin/export/products" download className={buttonVariants({ variant: "secondary" })}>
            <FileSpreadsheet />
            {t("template")}
          </a>
          <Button onClick={() => input.current?.click()} loading={pending && !plan}>
            <Upload />
            {file ? t("chooseOther") : t("upload")}
          </Button>
          <input
            ref={input}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) check(f);
            }}
          />
        </div>

        {file && (
          <div className="rounded-xl border border-line">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
              <p className="flex items-center gap-2 text-[13.5px] font-semibold text-graphite">
                <FileSpreadsheet className="size-4.5 text-sage-700" />
                {t("file", { name: file.name })}
              </p>
              {!plan && pending && <p className="text-[13px] text-ink-500">{t("checking")}</p>}
            </div>
            {plan && (
              <div className="space-y-4 px-4 py-4">
                <div>
                  <p className="text-[13px] font-semibold text-graphite">{t("preview")}</p>
                  <p className="mt-1 text-[13.5px] text-ink-600">{t("previewText", { rows: plan.rows, updates: plan.updates, creates: plan.creates, errors: plan.errors.length })}</p>
                  {plan.errors.length === 0 && plan.updates + plan.creates === 0 && <p className="mt-1 text-[13px] text-ink-500">{t("noChanges")}</p>}
                </div>
                {plan.errors.length > 0 && (
                  <div>
                    <p className="mb-2 text-[13px] font-semibold text-powder-800">{t("errors")}</p>
                    <ul className="max-h-72 space-y-1 overflow-y-auto rounded-lg bg-powder-50/60 px-3 py-2.5 text-[13px]">
                      {plan.errors.map((e, i) => (
                        <li key={`${e.row}-${i}`} className="flex gap-3">
                          <span className="w-20 shrink-0 font-semibold text-powder-800">{t("row", { row: e.row })}</span>
                          <span className="text-ink-700">{e.message}</span>
                        </li>
                      ))}
                    </ul>
                    {plan.errors.length >= 200 && <p className="mt-1.5 text-[12px] text-ink-500">{t("moreErrors", { count: 200 })}</p>}
                  </div>
                )}
                <Button onClick={apply} disabled={!canApply} loading={pending}>
                  {t("apply")}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}
