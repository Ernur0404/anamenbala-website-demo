"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Dialog, DialogContent } from "@/components/ui/primitives";
import { useAdminAction } from "@/components/admin/use-action";
import { adjustStockAction } from "@/server/actions/admin/stock";

export function AdjustStockButton({ variantId, current, name }: { variantId: string; current: number; name: string }) {
  const t = useTranslations("admin.stock");
  const tc = useTranslations("admin.common");
  const { pending, execute } = useAdminAction();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(String(current));
  const [note, setNote] = useState("");
  return (
    <>
      <Button
        size="xs"
        variant="secondary"
        onClick={() => {
          setQty(String(current));
          setNote("");
          setOpen(true);
        }}
      >
        {t("adjust")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={t("adjustTitle")} description={name} size="sm">
          <p className="mb-4 text-sm text-ink-600">{t("adjustText")}</p>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void execute(() => adjustStockAction({ variantId, quantity: Number(qty) || 0, note: note || null }), { success: t("adjusted"), onSuccess: () => setOpen(false) });
            }}
          >
            <Field label={`${t("newStock")} (${t("current")}: ${current})`}>
              <Input inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} autoFocus />
            </Field>
            <Field label={t("reason")}>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("reasonPlaceholder")} maxLength={300} />
            </Field>
            <div className="flex justify-end gap-2.5">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                {tc("cancel")}
              </Button>
              <Button type="submit" loading={pending} disabled={qty === "" || Number(qty) === current}>
                {tc("save")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
