"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { sendContactMessageAction } from "@/server/actions/store";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { formatPhoneInput } from "@/lib/phone-input";

export function ContactForm() {
  const t = useTranslations();
  const [form, setForm] = useState({ name: "", phone: "", message: "", website: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  if (sent) {
    return (
      <p className="flex items-start gap-3 rounded-lg bg-sage-50 p-4 text-sm font-medium text-sage-800">
        <CheckCircle2 className="size-5 shrink-0" />
        {t("pages.formSent")}
      </p>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await sendContactMessageAction(form);
          if (result.ok) setSent(true);
          else {
            setErrors(result.fieldErrors ?? {});
            toast.error(t(`errors.${result.code}`));
          }
        });
      }}
    >
      <Field label={t("pages.formName")} required error={errors.name && t("errors.required")}>
        <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required minLength={2} autoComplete="name" invalid={Boolean(errors.name)} />
      </Field>
      <Field label={t("pages.formPhone")} required error={errors.phone && t(`errors.${errors.phone === "invalidPhone" ? "invalidPhone" : "required"}`)}>
        <Input
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: formatPhoneInput(e.target.value) }))}
          onFocus={() => !form.phone && setForm((f) => ({ ...f, phone: "+7 " }))}
          inputMode="tel"
          autoComplete="tel"
          placeholder="+7 777 123 45 67"
          required
          invalid={Boolean(errors.phone)}
        />
      </Field>
      <Field label={t("pages.formMessage")} required error={errors.message && t("errors.tooShort")}>
        <Textarea value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} placeholder={t("pages.formMessagePlaceholder")} required minLength={5} rows={5} invalid={Boolean(errors.message)} />
      </Field>
      <input type="text" value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <Button type="submit" block size="lg" loading={pending}>
        {t("pages.formSend")}
      </Button>
    </form>
  );
}
