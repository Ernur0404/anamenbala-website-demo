"use client";

import { useTranslations } from "next-intl";
import { Trash } from "lucide-react";
import { ConfirmButton } from "@/components/admin/controls";
import { useAdminAction } from "@/components/admin/use-action";
import { deleteDemoAction } from "@/server/actions/admin/settings";

export function DeleteDemoButton() {
  const t = useTranslations("admin.settings.demo");
  const { execute } = useAdminAction();
  return (
    <ConfirmButton title={t("deleteTitle")} text={t("deleteText")} confirmLabel={t("delete")} variant="danger" onConfirm={() => execute(() => deleteDemoAction({ confirm: true }), { success: t("deleted") })}>
      <Trash />
      {t("delete")}
    </ConfirmButton>
  );
}
