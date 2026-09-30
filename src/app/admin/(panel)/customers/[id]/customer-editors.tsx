"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Dialog, DialogContent } from "@/components/ui/primitives";
import { useAdminAction } from "@/components/admin/use-action";
import { updateCustomerAction } from "@/server/actions/admin/customers";

export function NotesEditor({ id, initial }: { id: string; initial: string }) {
  const t = useTranslations("admin.customers.card");
  const { pending, execute } = useAdminAction();
  const [notes, setNotes] = useState(initial);
  return (
    <div className="space-y-3">
      <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("notesPlaceholder")} maxLength={3000} />
      <Button size="sm" variant="secondary" loading={pending} disabled={notes === initial} onClick={() => void execute(() => updateCustomerAction({ id, notes }), { success: t("notesSaved") })}>
        {t("saveNotes")}
      </Button>
    </div>
  );
}

export function CustomerEditor({ customer }: { customer: { id: string; name: string; email: string; city: string } }) {
  const t = useTranslations("admin.customers.card");
  const tc = useTranslations("admin.common");
  const { pending, execute, fieldError } = useAdminAction();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(customer);
  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => {
          setForm(customer);
          setOpen(true);
        }}
      >
        <Pencil />
        {t("edit")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={t("edit")} size="sm">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void execute(() => updateCustomerAction(form), { success: t("saved"), onSuccess: () => setOpen(false) });
            }}
          >
            <Field label={t("name")} error={fieldError("name")}>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={100} />
            </Field>
            <Field label={t("email")} error={fieldError("email")}>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label={t("city")}>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} maxLength={120} />
            </Field>
            <div className="flex justify-end gap-2.5">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                {tc("cancel")}
              </Button>
              <Button type="submit" loading={pending} disabled={!form.name.trim()}>
                {tc("save")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
