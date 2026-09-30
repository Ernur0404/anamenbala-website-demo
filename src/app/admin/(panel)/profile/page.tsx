import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { db } from "@/server/db";
import { getStaffSessionState, requireStaff } from "@/server/auth/staff";
import { PageHeader } from "@/components/admin/ui";
import { ProfileForms } from "./profile-forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.profile");
  return { title: t("title") };
}

export default async function ProfilePage() {
  const staff = await requireStaff();
  const state = await getStaffSessionState();
  const t = await getTranslations("admin.profile");
  const sessions = await db.staffSession.findMany({
    where: { staffUserId: staff.id, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: "desc" },
    select: { id: true, ip: true, userAgent: true, lastSeenAt: true, createdAt: true },
  });
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <ProfileForms
        staff={{ name: staff.name, email: staff.email, role: staff.role, locale: staff.locale, totpEnabled: staff.totpEnabled }}
        sessions={sessions.map((s) => ({ ...s, lastSeenAt: s.lastSeenAt.toISOString(), createdAt: s.createdAt.toISOString(), current: s.id === state?.session.id }))}
      />
    </>
  );
}
