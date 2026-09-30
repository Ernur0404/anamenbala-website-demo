"use client";

import { useTranslations } from "next-intl";
import { Trash } from "lucide-react";
import { ConfirmButton } from "@/components/admin/controls";
import { useAdminAction } from "@/components/admin/use-action";
import { deleteSubscriberAction } from "@/server/actions/admin/customers";

export function DeleteSubscriberButton({ id, email }: { id: string; email: string }) {
  const t = useTranslations("admin.customers.subscribers");
  const tc = useTranslations("admin.common");
  const { execute } = useAdminAction();
  return (
    <ConfirmButton title={t("deleteTitle", { email })} confirmLabel={tc("delete")} size="iconSm" variant="ghost" className="text-ink-400 hover:bg-powder-50 hover:text-powder-800" aria-label={tc("delete")} onConfirm={() => execute(() => deleteSubscriberAction({ id }), { success: tc("deleted") })}>
      <Trash className="size-4" />
    </ConfirmButton>
  );
}
