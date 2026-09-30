"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Plus, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { Panel } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/controls";
import { useAdminAction } from "@/components/admin/use-action";
import { deleteAttributeAction, saveAttributeAction } from "@/server/actions/admin/catalog";
import { slugify } from "@/lib/slug";

type Value = { key: string; id: string | null; valueRu: string; valueKk: string; slug: string; colorHex: string };
type Form = {
  id: string | null;
  code: string;
  nameRu: string;
  nameKk: string;
  type: "SELECT" | "MULTISELECT" | "COLOR";
  display: "CHECKBOX" | "CHIPS" | "SWATCH";
  isFilterable: boolean;
  isVariantAxis: boolean;
  unit: string;
  values: Value[];
};

let seq = 0;

export function AttributeForm({ initial }: { initial: Form }) {
  const t = useTranslations("admin.catalog");
  const tc = useTranslations("admin.common");
  const router = useRouter();
  const { pending, execute, fieldError } = useAdminAction();
  const [form, setForm] = useState<Form>(initial);
  const [codeTouched, setCodeTouched] = useState(Boolean(initial.id));
  const isColor = form.type === "COLOR" || form.display === "SWATCH";

  const setValue = (key: string, patch: Partial<Value>) => setForm((f) => ({ ...f, values: f.values.map((v) => (v.key === key ? { ...v, ...patch } : v)) }));
  const moveValue = (index: number, dir: -1 | 1) =>
    setForm((f) => {
      const list = [...f.values];
      const target = index + dir;
      if (target < 0 || target >= list.length) return f;
      [list[index], list[target]] = [list[target], list[index]];
      return { ...f, values: list };
    });

  const save = () =>
    execute(
      () =>
        saveAttributeAction({
          ...form,
          values: form.values.filter((v) => v.valueRu.trim()).map((v) => ({ id: v.id, valueRu: v.valueRu, valueKk: v.valueKk, slug: v.slug, colorHex: isColor ? v.colorHex : "" })),
        }),
      {
        success: t("saved"),
        onSuccess: (d) => {
          if (!form.id) router.replace(`/admin/catalog/attributes/${d.id}`);
        },
        errorMessage: (f) => (f.details?.reason === "valueInUse" ? t("attr.valueInUse", { value: String(f.details.value ?? "") }) : undefined),
      },
    );

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-5">
        <Panel>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t("fields.nameRu")} required error={fieldError("nameRu")}>
              <Input
                value={form.nameRu}
                maxLength={80}
                onChange={(e) => {
                  const nameRu = e.target.value;
                  setForm((f) => ({ ...f, nameRu, ...(codeTouched ? {} : { code: slugify(nameRu).replace(/-/g, "_").slice(0, 40) }) }));
                }}
              />
            </Field>
            <Field label={t("fields.nameKk")}>
              <Input value={form.nameKk} maxLength={80} onChange={(e) => setForm((f) => ({ ...f, nameKk: e.target.value }))} />
            </Field>
            <Field label={t("attr.code")} hint={t("attr.codeHint")} error={fieldError("code")}>
              <Input
                value={form.code}
                maxLength={40}
                onChange={(e) => {
                  setCodeTouched(true);
                  setForm((f) => ({ ...f, code: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") }));
                }}
              />
            </Field>
            <Field label={t("attr.unit")}>
              <Input value={form.unit} maxLength={20} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} />
            </Field>
            <Field label={t("attr.type")}>
              <Select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as Form["type"], display: e.target.value === "COLOR" ? "SWATCH" : f.display }))}>
                {(["MULTISELECT", "SELECT", "COLOR"] as const).map((x) => (
                  <option key={x} value={x}>
                    {t(`attr.types.${x}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("attr.display")}>
              <Select value={form.display} onChange={(e) => setForm((f) => ({ ...f, display: e.target.value as Form["display"] }))}>
                {(["CHECKBOX", "CHIPS", "SWATCH"] as const).map((x) => (
                  <option key={x} value={x}>
                    {t(`attr.displays.${x}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Panel>

        <Panel title={t("attr.values")} subtitle={t("attr.valuesCount", { count: form.values.length })}>
          <div className="space-y-2">
            {form.values.map((v, i) => (
              <div key={v.key} className="grid items-center gap-2 rounded-lg border border-line p-2 sm:grid-cols-[auto_1fr_1fr_auto_auto]">
                <div className="flex gap-1">
                  <button type="button" onClick={() => moveValue(i, -1)} disabled={i === 0} className="grid size-8 place-items-center rounded-md text-ink-500 hover:bg-cream disabled:opacity-30" aria-label={t("moveUp")}>
                    <ArrowUp className="size-3.5" />
                  </button>
                  <button type="button" onClick={() => moveValue(i, 1)} disabled={i === form.values.length - 1} className="grid size-8 place-items-center rounded-md text-ink-500 hover:bg-cream disabled:opacity-30" aria-label={t("moveDown")}>
                    <ArrowDown className="size-3.5" />
                  </button>
                </div>
                <Input value={v.valueRu} onChange={(e) => setValue(v.key, { valueRu: e.target.value })} placeholder={t("attr.valueRu")} aria-label={t("attr.valueRu")} className="h-9" maxLength={80} />
                <Input value={v.valueKk} onChange={(e) => setValue(v.key, { valueKk: e.target.value })} placeholder={t("attr.valueKk")} aria-label={t("attr.valueKk")} className="h-9" maxLength={80} />
                {isColor ? (
                  <label className="flex items-center gap-1.5">
                    <input type="color" value={v.colorHex || "#cccccc"} onChange={(e) => setValue(v.key, { colorHex: e.target.value })} className="size-9 cursor-pointer rounded-md border border-line bg-white p-0.5" aria-label={t("attr.color")} />
                    <span className="w-16 font-mono text-[11.5px] text-ink-500">{v.colorHex || "—"}</span>
                  </label>
                ) : (
                  <span className="hidden font-mono text-[11.5px] text-ink-400 sm:block">{v.slug}</span>
                )}
                <button type="button" onClick={() => setForm((f) => ({ ...f, values: f.values.filter((x) => x.key !== v.key) }))} className="grid size-9 place-items-center rounded-md text-ink-400 hover:bg-powder-50 hover:text-powder-800" aria-label={tc("delete")}>
                  <Trash className="size-4" />
                </button>
              </div>
            ))}
          </div>
          <Button variant="soft" size="sm" className="mt-3" onClick={() => setForm((f) => ({ ...f, values: [...f.values, { key: `n${seq++}`, id: null, valueRu: "", valueKk: "", slug: "", colorHex: "" }] }))}>
            <Plus />
            {t("attr.addValue")}
          </Button>
        </Panel>
      </div>

      <div className="space-y-5 xl:sticky xl:top-24">
        <Panel>
          <div className="space-y-3">
            <Checkbox label={t("attr.isFilterable")} checked={form.isFilterable} onChange={(e) => setForm((f) => ({ ...f, isFilterable: e.target.checked }))} />
            <Checkbox label={t("attr.isVariantAxis")} checked={form.isVariantAxis} onChange={(e) => setForm((f) => ({ ...f, isVariantAxis: e.target.checked }))} />
          </div>
          <Button block className="mt-5" loading={pending} disabled={!form.nameRu.trim() || !form.code} onClick={() => void save()}>
            {tc("save")}
          </Button>
          {form.id && (
            <ConfirmButton
              title={t("attr.deleteAttr")}
              text={t("attr.deleteAttrText")}
              confirmLabel={tc("delete")}
              variant="ghost"
              className="mt-2 w-full text-powder-800"
              onConfirm={() =>
                execute(() => deleteAttributeAction({ id: form.id! }), {
                  success: t("deleted"),
                  onSuccess: () => router.push("/admin/catalog/attributes"),
                  errorMessage: (f) => (f.details?.reason === "attrInUse" ? t("attr.attrInUse") : undefined),
                })
              }
            >
              {t("attr.deleteAttr")}
            </ConfirmButton>
          )}
        </Panel>
      </div>
    </div>
  );
}
