"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Copy, ExternalLink, Pencil, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Select } from "@/components/ui/form";
import { StatusPill, type Tone } from "@/components/ui/display";
import { DataTable, EmptyRow, Td, Th, Thumb, Tr } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/controls";
import { useAdminAction } from "@/components/admin/use-action";
import { bulkProductsAction, deleteProductAction, duplicateProductAction } from "@/server/actions/admin/products";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export type ProductRow = {
  id: string;
  slug: string;
  name: string;
  status: "PUBLISHED" | "DRAFT" | "HIDDEN";
  category: string | null;
  priceMin: number;
  priceMax: number;
  regularMin: number;
  discountPercent: number;
  totalStock: number;
  variants: number;
  stockState: "in" | "low" | "out" | "backorder";
  imageUrl: string | null;
  isDemo: boolean;
};

const STATUS_TONE: Record<ProductRow["status"], Tone> = { PUBLISHED: "sage", DRAFT: "gray", HIDDEN: "beige" };
const STOCK_TONE: Record<ProductRow["stockState"], Tone> = { in: "sage", low: "amber", out: "powder", backorder: "sky" };

export function ProductsTable({ rows, empty, filtered }: { rows: ProductRow[]; empty: boolean; filtered: boolean }) {
  const t = useTranslations("admin.products");
  const tc = useTranslations("admin.common");
  const router = useRouter();
  const { pending, execute } = useAdminAction();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<"" | "publish" | "hide" | "draft" | "delete">("");
  const visibleIds = rows.map((r) => r.id);
  const allChecked = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const runBulk = () =>
    bulk &&
    execute(() => bulkProductsAction({ ids: [...selected], action: bulk }), {
      success: t("bulk.done", { count: selected.size }),
      onSuccess: () => {
        setSelected(new Set());
        setBulk("");
      },
    });

  return (
    <>
      <DataTable minWidth={860}>
        <thead className="bg-cream/60">
          <tr>
            <Th className="w-10">
              <Checkbox checked={allChecked} onChange={() => setSelected(allChecked ? new Set() : new Set(visibleIds))} aria-label={tc("selectAll")} />
            </Th>
            <Th>{t("columns.photo")}</Th>
            <Th>{t("columns.name")}</Th>
            <Th>{t("columns.category")}</Th>
            <Th align="right">{t("columns.price")}</Th>
            <Th align="right">{t("columns.stock")}</Th>
            <Th>{t("columns.status")}</Th>
            <Th align="right">{t("columns.actions")}</Th>
          </tr>
        </thead>
        <tbody>
          {empty && <EmptyRow colSpan={8} title={filtered ? tc("nothingFound") : t("emptyTitle")} text={filtered ? tc("tryOtherFilters") : t("emptyText")} />}
          {rows.map((p) => (
            <Tr key={p.id} className={cn(selected.has(p.id) && "bg-sage-50/60")}>
              <Td>
                <Checkbox checked={selected.has(p.id)} onChange={() => toggle(p.id)} aria-label={p.name} />
              </Td>
              <Td>
                <Link href={`/admin/products/${p.id}`}>
                  <Thumb src={p.imageUrl} alt={p.name} size={52} className="rounded-lg" />
                </Link>
              </Td>
              <Td>
                <Link href={`/admin/products/${p.id}`} className="line-clamp-2 max-w-72 font-semibold text-graphite hover:text-sage-700">
                  {p.name}
                </Link>
                <p className="mt-0.5 text-[12px] text-ink-500">
                  {p.variants > 1 ? t("variantsCount", { count: p.variants }) : null}
                  {p.isDemo && <span className="ml-1.5 rounded bg-beige-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-beige-700">{tc("demo")}</span>}
                </p>
              </Td>
              <Td>{p.category ? <StatusPill tone="sage" className="bg-sage-50 font-medium">{p.category}</StatusPill> : <span className="text-ink-400">—</span>}</Td>
              <Td align="right" className="whitespace-nowrap">
                <p className="font-semibold text-graphite">{p.priceMin === p.priceMax ? formatMoney(p.priceMin) : t("fromPrice", { price: formatMoney(p.priceMin) })}</p>
                {p.discountPercent > 0 && <p className="text-[11.5px] text-ink-400 line-through">{formatMoney(p.regularMin)}</p>}
              </Td>
              <Td align="right" className="font-medium text-graphite">
                {p.totalStock}
              </Td>
              <Td>
                <div className="flex flex-col items-start gap-1">
                  {p.status === "PUBLISHED" ? (
                    <StatusPill tone={STOCK_TONE[p.stockState]}>{t(`stockState.${p.stockState}`)}</StatusPill>
                  ) : (
                    <StatusPill tone={STATUS_TONE[p.status]}>{t(`status.${p.status}`)}</StatusPill>
                  )}
                </div>
              </Td>
              <Td align="right">
                <div className="flex justify-end gap-1.5">
                  <Link href={`/admin/products/${p.id}`} className="grid size-8 place-items-center rounded-md border border-line bg-white text-ink-600 hover:border-sage-400 hover:text-sage-700" aria-label={t("edit")} title={t("edit")}>
                    <Pencil className="size-3.5" />
                  </Link>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void execute(() => duplicateProductAction({ id: p.id }), { success: t("duplicated"), onSuccess: (d) => router.push(`/admin/products/${d.id}`) })}
                    className="grid size-8 place-items-center rounded-md border border-line bg-white text-ink-600 hover:border-sage-400 hover:text-sage-700"
                    aria-label={t("duplicate")}
                    title={t("duplicate")}
                  >
                    <Copy className="size-3.5" />
                  </button>
                  {p.status === "PUBLISHED" && (
                    <a href={`/product/${p.slug}`} target="_blank" rel="noreferrer" className="grid size-8 place-items-center rounded-md border border-line bg-white text-ink-600 hover:border-sage-400 hover:text-sage-700" aria-label={t("view")} title={t("view")}>
                      <ExternalLink className="size-3.5" />
                    </a>
                  )}
                  <ConfirmButton
                    title={t("deleteTitle", { name: p.name })}
                    text={t("deleteText")}
                    confirmLabel={tc("delete")}
                    size="iconSm"
                    variant="ghost"
                    className="border border-line bg-white text-ink-600 hover:border-powder-300 hover:bg-powder-50 hover:text-powder-800"
                    aria-label={t("delete")}
                    onConfirm={() =>
                      execute(() => deleteProductAction({ id: p.id }), {
                        success: false,
                        onSuccess: (r) => {
                          import("sonner").then(({ toast }) => toast.success(r.hidden ? t("hiddenInstead") : t("deletedOrHidden")));
                        },
                      })
                    }
                  >
                    <Trash className="size-3.5" />
                  </ConfirmButton>
                </div>
              </Td>
            </Tr>
          ))}
        </tbody>
      </DataTable>

      {/* массовые действия — как в макете */}
      <div className="flex flex-wrap items-center gap-3 border-t border-line bg-cream/40 px-5 py-3.5 sm:px-6">
        <span className="text-[13px] font-semibold text-graphite">{tc("bulkActions")}</span>
        <span className="text-[13px] text-ink-500">{tc("selected", { count: selected.size })}</span>
        <Select value={bulk} onChange={(e) => setBulk(e.target.value as typeof bulk)} wrapperClassName="w-52" className="h-9 text-[13px]" disabled={selected.size === 0}>
          <option value="">{tc("chooseAction")}</option>
          <option value="publish">{t("bulk.publish")}</option>
          <option value="hide">{t("bulk.hide")}</option>
          <option value="draft">{t("bulk.draft")}</option>
          <option value="delete">{t("bulk.delete")}</option>
        </Select>
        {bulk === "delete" ? (
          <ConfirmButton title={t("bulk.deleteTitle")} text={t("bulk.deleteText")} confirmLabel={tc("delete")} size="sm" disabled={selected.size === 0} onConfirm={() => runBulk() || undefined}>
            {tc("apply")}
          </ConfirmButton>
        ) : (
          <Button size="sm" disabled={!bulk || selected.size === 0} loading={pending} onClick={() => void runBulk()}>
            {tc("apply")}
          </Button>
        )}
      </div>
    </>
  );
}
