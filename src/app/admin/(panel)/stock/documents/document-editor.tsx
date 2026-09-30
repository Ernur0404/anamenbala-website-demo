"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/form";
import { Panel, Thumb } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/controls";
import { VariantPicker } from "@/components/admin/variant-picker";
import { useAdminAction } from "@/components/admin/use-action";
import { deleteStockDocumentAction, postStockDocumentAction, saveStockDocumentAction } from "@/server/actions/admin/stock";
import { parseMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

type DocType = "RECEIPT" | "WRITE_OFF" | "ADJUSTMENT";
type Line = { variantId: string; name: string; label: string | null; sku: string; imageUrl: string | null; current: number; quantity: number; costPrice: number | null };
type Doc = { id: string | null; type: DocType; status: "DRAFT" | "POSTED"; supplier: string; note: string; lines: Line[] };

export function StockDocumentEditor({ doc, finance }: { doc: Doc; finance: boolean }) {
  const t = useTranslations("admin.stock");
  const tc = useTranslations("admin.common");
  const router = useRouter();
  const { pending, execute } = useAdminAction();
  const [supplier, setSupplier] = useState(doc.supplier);
  const [note, setNote] = useState(doc.note);
  const [lines, setLines] = useState<Line[]>(doc.lines);
  const [updateCost, setUpdateCost] = useState(false);
  const readOnly = doc.status === "POSTED";
  const isAdjustment = doc.type === "ADJUSTMENT";

  const setLine = (variantId: string, patch: Partial<Line>) => setLines((prev) => prev.map((l) => (l.variantId === variantId ? { ...l, ...patch } : l)));
  const payload = () => ({
    id: doc.id,
    type: doc.type,
    supplier: supplier || null,
    note: note || null,
    lines: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity, costPrice: l.costPrice })),
  });

  /** Сохранить черновик; возвращает id документа */
  const saveDraft = async (notify = true): Promise<string | null> => {
    const res = await execute(() => saveStockDocumentAction(payload()), { success: notify ? t("saved") : false });
    if (!res?.ok) return null;
    if (!doc.id) router.replace(`/admin/stock/documents/${res.data.id}`);
    else router.refresh();
    return res.data.id;
  };

  const post = async () => {
    const id = await saveDraft(false);
    if (!id) return;
    const res = await execute(() => postStockDocumentAction({ id, updateCost }), { success: t("posted") });
    if (res?.ok) router.replace(`/admin/stock/documents/${id}`);
  };

  const totalQty = lines.reduce((s, l) => s + l.quantity, 0);

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Panel title={t("lines")} padded={false}>
        {!readOnly && (
          <div className="px-5 pb-4 sm:px-6">
            <VariantPicker
              showPrice={false}
              onPick={(v) =>
                setLines((prev) => {
                  const existing = prev.find((l) => l.variantId === v.variantId);
                  if (existing) return prev.map((l) => (l === existing ? { ...l, quantity: isAdjustment ? l.quantity : l.quantity + 1 } : l));
                  return [...prev, { variantId: v.variantId, name: v.name, label: v.label, sku: v.sku, imageUrl: v.imageUrl, current: v.stock, quantity: isAdjustment ? Math.max(0, v.stock) : 1, costPrice: null }];
                })
              }
            />
          </div>
        )}
        {lines.length === 0 ? (
          <p className="border-t border-line px-6 py-10 text-center text-sm text-ink-500">{t("addLine")}</p>
        ) : (
          <div className="overflow-x-auto border-t border-line">
            <table className="w-full min-w-[620px] text-[13.5px]">
              <thead className="bg-cream/60 text-left text-[12px] text-ink-500">
                <tr>
                  <th className="px-5 py-2.5 font-semibold sm:px-6">{t("columns.product")}</th>
                  <th className="w-20 px-2 py-2.5 text-right font-semibold">{t("current")}</th>
                  <th className="w-28 px-2 py-2.5 font-semibold">{isAdjustment ? t("actual") : t("qty")}</th>
                  {isAdjustment && <th className="w-20 px-2 py-2.5 text-right font-semibold">{t("diff")}</th>}
                  {doc.type === "RECEIPT" && finance && <th className="w-32 px-2 py-2.5 font-semibold">{t("lineCost")}</th>}
                  {!readOnly && <th className="w-12" />}
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const diff = l.quantity - l.current;
                  const short = doc.type === "WRITE_OFF" && l.quantity > l.current;
                  return (
                    <tr key={l.variantId} className="border-t border-line">
                      <td className="px-5 py-2.5 sm:px-6">
                        <div className="flex items-center gap-3">
                          <Thumb src={l.imageUrl} size={38} />
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-graphite">{l.name}</p>
                            <p className="text-[12px] text-ink-500">{[l.label, l.sku].filter(Boolean).join(" · ")}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-right text-ink-600">{l.current}</td>
                      <td className="px-2 py-2.5">
                        {readOnly ? (
                          <span className="font-semibold">{l.quantity}</span>
                        ) : (
                          <input
                            inputMode="numeric"
                            value={l.quantity}
                            onChange={(e) => setLine(l.variantId, { quantity: Number(e.target.value.replace(/\D/g, "")) || 0 })}
                            className={cn("h-9 w-24 rounded-md border bg-white px-2.5 text-right font-semibold outline-none focus:border-sage-500", short ? "border-powder-600" : "border-line-strong")}
                            aria-label={t("qty")}
                          />
                        )}
                      </td>
                      {isAdjustment && <td className={cn("px-2 py-2.5 text-right font-semibold", diff > 0 ? "text-sage-700" : diff < 0 ? "text-powder-700" : "text-ink-400")}>{diff > 0 ? `+${diff}` : diff}</td>}
                      {doc.type === "RECEIPT" && finance && (
                        <td className="px-2 py-2.5">
                          {readOnly ? (
                            <span>{l.costPrice ?? "—"}</span>
                          ) : (
                            <input
                              inputMode="numeric"
                              value={l.costPrice ?? ""}
                              onChange={(e) => setLine(l.variantId, { costPrice: parseMoney(e.target.value) })}
                              className="h-9 w-28 rounded-md border border-line-strong bg-white px-2.5 text-right outline-none focus:border-sage-500"
                              aria-label={t("lineCost")}
                            />
                          )}
                        </td>
                      )}
                      {!readOnly && (
                        <td className="pr-4">
                          <button type="button" onClick={() => setLines((prev) => prev.filter((x) => x.variantId !== l.variantId))} className="grid size-8 place-items-center rounded-md text-ink-400 hover:bg-powder-50 hover:text-powder-800" aria-label={tc("remove")}>
                            <Trash className="size-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="space-y-5 xl:sticky xl:top-24">
        <Panel>
          <div className="space-y-4">
            {doc.type === "RECEIPT" && (
              <Field label={t("supplier")}>
                <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} disabled={readOnly} maxLength={200} />
              </Field>
            )}
            <Field label={t("note")}>
              <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} disabled={readOnly} maxLength={1000} />
            </Field>
            <p className="text-[13px] text-ink-600">
              {t("docColumns.lines")}: <b className="text-graphite">{lines.length}</b> · {t("docColumns.qty")}: <b className="text-graphite">{totalQty}</b>
            </p>
            {!readOnly && doc.type === "RECEIPT" && finance && <Checkbox label={t("updateCost")} checked={updateCost} onChange={(e) => setUpdateCost(e.target.checked)} />}
            {!readOnly && (
              <div className="space-y-2.5">
                <ConfirmButton title={t("postTitle")} text={t("postText")} confirmLabel={t("post")} tone="primary" variant="primary" className="w-full" disabled={lines.length === 0 || pending} onConfirm={post}>
                  {t("post")}
                </ConfirmButton>
                <Button block variant="secondary" loading={pending} disabled={lines.length === 0} onClick={() => void saveDraft()}>
                  {t("saveDraft")}
                </Button>
                {doc.id && (
                  <ConfirmButton
                    title={t("deleteDraft")}
                    text={tc("cannotUndo")}
                    confirmLabel={tc("delete")}
                    variant="ghost"
                    className="w-full text-powder-800"
                    onConfirm={() =>
                      execute(() => deleteStockDocumentAction({ id: doc.id! }), {
                        success: t("deleted"),
                        onSuccess: () => router.push("/admin/stock/documents"),
                      })
                    }
                  >
                    {t("deleteDraft")}
                  </ConfirmButton>
                )}
              </div>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
