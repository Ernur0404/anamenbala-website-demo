import { getTranslations } from "next-intl/server";
import { requireStaff } from "@/server/auth/staff";
import { PageHeader } from "@/components/admin/ui";

export default async function DashboardPage() {
  await requireStaff("dashboard");
  const t = await getTranslations("admin.nav");
  return <PageHeader title={t("dashboard")} />;
}
