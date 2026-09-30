import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { db } from "@/server/db";
import { getCurrentUser } from "@/server/auth/customer";
import { AddressBook } from "@/components/store/account/account-forms";

export const metadata: Metadata = { title: "Адреса", robots: { index: false } };

export default async function AddressesPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const t = await getTranslations("account");
  const addresses = await db.address.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] });
  return (
    <div>
      <h2 className="heading-section mb-5 text-[30px]">{t("addresses")}</h2>
      {!addresses.length && <p className="mb-4 text-sm text-ink-500">{t("noAddresses")}</p>}
      <AddressBook addresses={addresses} />
    </div>
  );
}
