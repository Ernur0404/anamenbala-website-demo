"use client";

import { useTranslations } from "next-intl";
import { Check, Trash, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/ui/icons";
import { ConfirmButton } from "@/components/admin/controls";
import { useAdminAction } from "@/components/admin/use-action";
import { deleteMessageAction, setMessageStatusAction } from "@/server/actions/admin/customers";
import { whatsappLink } from "@/lib/phone";

export function MessageActions({ id, status, phone, name, locale }: { id: string; status: "NEW" | "DONE"; phone: string; name: string; locale: string }) {
  const t = useTranslations("admin.customers.messages");
  const tc = useTranslations("admin.common");
  const { pending, execute } = useAdminAction();
  return (
    <div className="flex shrink-0 flex-wrap gap-2">
      <Button size="sm" variant="secondary" asChild>
        <a href={whatsappLink(phone, locale === "kk" ? `${name}, сәлеметсіз бе! «Ана мен бала» дүкені жазып отыр.` : `${name}, здравствуйте! Это магазин «Ана мен бала».`)} target="_blank" rel="noreferrer">
          <WhatsAppIcon size={14} />
          {t("reply")}
        </a>
      </Button>
      {status === "NEW" ? (
        <Button size="sm" loading={pending} onClick={() => void execute(() => setMessageStatusAction({ id, status: "DONE" }), { success: false })}>
          <Check />
          {t("markDone")}
        </Button>
      ) : (
        <Button size="sm" variant="ghost" loading={pending} onClick={() => void execute(() => setMessageStatusAction({ id, status: "NEW" }), { success: false })}>
          <Undo2 />
          {t("markNew")}
        </Button>
      )}
      <ConfirmButton title={t("delete")} text={tc("cannotUndo")} confirmLabel={tc("delete")} size="iconSm" variant="ghost" className="text-ink-400 hover:bg-powder-50 hover:text-powder-800" aria-label={t("delete")} onConfirm={() => execute(() => deleteMessageAction({ id }), { success: tc("deleted") })}>
        <Trash className="size-4" />
      </ConfirmButton>
    </div>
  );
}
