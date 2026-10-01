import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireStaff } from "@/server/auth/staff";
import { getSetting } from "@/server/settings";
import { db } from "@/server/db";
import { mediaSelect } from "@/server/media/refs";
import { PageHeader } from "@/components/admin/ui";
import { mediaUrl } from "@/lib/media-url";
import { SettingsNav } from "./settings-nav";
import { GeneralForm, ContactsForm } from "./general-forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.settings");
  return { title: t("title") };
}

export default async function SettingsPage() {
  await requireStaff("settings");
  const t = await getTranslations("admin.settings");
  const [general, contacts] = await Promise.all([getSetting("general"), getSetting("contacts")]);
  const media = await db.media.findMany({ where: { id: { in: [general.logoMediaId, general.faviconMediaId].filter((x): x is string => Boolean(x)) } }, select: mediaSelect });
  const img = (id: string | null) => {
    const m = media.find((x) => x.id === id);
    return m ? { id: m.id, url: mediaUrl(m, 320) } : null;
  };
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <SettingsNav active="general" />
      <div className="space-y-5">
        <GeneralForm
          initial={{
            storeName: general.storeName,
            tagline: { ru: general.tagline.ru, kk: general.tagline.kk },
            shortDescription: { ru: general.shortDescription.ru, kk: general.shortDescription.kk },
            logo: img(general.logoMediaId),
            favicon: img(general.faviconMediaId),
            lowStockThreshold: general.lowStockThreshold,
            newArrivalDays: general.newArrivalDays,
          }}
        />
        <ContactsForm initial={contacts} />
      </div>
    </>
  );
}
