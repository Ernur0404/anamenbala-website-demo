import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { requireStaff } from "@/server/auth/staff";
import { db } from "@/server/db";
import { PageHeader } from "@/components/admin/ui";
import { formatDateTime } from "@/lib/dates";
import { SettingsNav } from "../settings-nav";
import { StaffManager } from "./staff-manager";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.settings.tabs");
  return { title: t("staff") };
}

export default async function StaffSettingsPage() {
  const me = await requireStaff("staff");
  const [t, locale] = await Promise.all([getTranslations("admin.settings"), getLocale()]);
  const staff = await db.staffUser.findMany({
    orderBy: [{ isActive: "desc" }, { role: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, email: true, role: true, locale: true, isActive: true, totpEnabled: true, lastLoginAt: true },
  });
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <SettingsNav active="staff" />
      <StaffManager
        meId={me.id}
        staff={staff.map((s) => ({
          id: s.id,
          name: s.name,
          email: s.email,
          role: s.role,
          locale: s.locale === "kk" ? "kk" : "ru",
          isActive: s.isActive,
          totpEnabled: s.totpEnabled,
          lastLogin: s.lastLoginAt ? formatDateTime(s.lastLoginAt, locale) : null,
        }))}
      />
    </>
  );
}
