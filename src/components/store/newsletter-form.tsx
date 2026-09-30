"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { subscribeNewsletterAction } from "@/server/actions/store";
import { Button } from "@/components/ui/button";

export function NewsletterForm() {
  const t = useTranslations();
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await subscribeNewsletterAction(email);
      if (result.ok) {
        setDone(true);
        setEmail("");
      } else toast.error(t(result.code === "VALIDATION" ? "errors.invalidEmail" : `errors.${result.code}`));
    });
  };

  if (done) {
    return (
      <p className="flex items-center gap-2 rounded-md bg-sage-100 px-4 py-3 text-sm font-semibold text-sage-800">
        <Check className="size-4" />
        {t("footer.subscribed")}
      </p>
    );
  }
  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t("footer.newsletterPlaceholder")}
        aria-label={t("footer.newsletterPlaceholder")}
        className="h-10 min-w-0 flex-1 rounded-md border border-line-strong bg-white px-3 text-sm outline-none focus:border-sage-500 focus:ring-3 focus:ring-sage-500/15"
      />
      <Button type="submit" size="sm" className="h-10" loading={pending}>
        {t("footer.subscribe")}
      </Button>
    </form>
  );
}
