"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { LogoMark, InstagramIcon, TelegramIcon, TikTokIcon, WhatsAppIcon } from "@/components/ui/icons";
import { Panel } from "@/components/admin/ui";
import { ImageField } from "@/components/admin/media";
import { useAdminAction } from "@/components/admin/use-action";
import { saveContactsAction, saveGeneralAction } from "@/server/actions/admin/settings";
import { formatPhoneInput } from "@/lib/phone-input";

type L = { ru: string; kk: string };
type Img = { id: string; url: string | null } | null;

export function GeneralForm({
  initial,
}: {
  initial: { storeName: string; tagline: L; shortDescription: L; logo: Img; favicon: Img; lowStockThreshold: number; newArrivalDays: number };
}) {
  const t = useTranslations("admin.settings");
  const tc = useTranslations("admin.common");
  const { pending, execute } = useAdminAction();
  const [form, setForm] = useState(initial);

  return (
    <Panel title={t("general.main")} serif>
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void execute(
            () =>
              saveGeneralAction({
                storeName: form.storeName,
                tagline: form.tagline,
                shortDescription: form.shortDescription,
                logoMediaId: form.logo?.id ?? null,
                faviconMediaId: form.favicon?.id ?? null,
                lowStockThreshold: form.lowStockThreshold,
                newArrivalDays: form.newArrivalDays,
              }),
            { success: t("saved") },
          );
        }}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("general.storeName")} required>
            <Input value={form.storeName} onChange={(e) => setForm({ ...form, storeName: e.target.value })} maxLength={80} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("general.taglineRu")}>
              <Input value={form.tagline.ru} onChange={(e) => setForm({ ...form, tagline: { ...form.tagline, ru: e.target.value } })} maxLength={80} />
            </Field>
            <Field label={t("general.taglineKk")}>
              <Input value={form.tagline.kk} onChange={(e) => setForm({ ...form, tagline: { ...form.tagline, kk: e.target.value } })} maxLength={80} />
            </Field>
          </div>
          <Field label={t("general.descriptionRu")}>
            <Textarea rows={2} value={form.shortDescription.ru} onChange={(e) => setForm({ ...form, shortDescription: { ...form.shortDescription, ru: e.target.value } })} maxLength={300} />
          </Field>
          <Field label={t("general.descriptionKk")}>
            <Textarea rows={2} value={form.shortDescription.kk} onChange={(e) => setForm({ ...form, shortDescription: { ...form.shortDescription, kk: e.target.value } })} maxLength={300} />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {(["logo", "favicon"] as const).map((key) => (
            <div key={key} className="flex items-center gap-4">
              <div className="w-24 shrink-0">
                <ImageField value={form[key]} onChange={(v) => setForm({ ...form, [key]: v })} aspect="aspect-square" compact />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-graphite">{t(`general.${key}`)}</p>
                <p className="mt-0.5 text-[12px] text-ink-500">{t(`general.${key}Hint`)}</p>
                {!form[key] && (
                  <p className="mt-2 flex items-center gap-2 text-[12px] text-ink-400">
                    <LogoMark size={20} /> {t("general.defaultLogo")}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("general.lowStock")} hint={t("general.lowStockHint")}>
            <Input inputMode="numeric" value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
          </Field>
          <Field label={t("general.newArrivalDays")}>
            <Input inputMode="numeric" value={form.newArrivalDays} onChange={(e) => setForm({ ...form, newArrivalDays: Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1) })} />
          </Field>
        </div>
        <Button type="submit" loading={pending} disabled={!form.storeName.trim()}>
          {tc("save")}
        </Button>
      </form>
    </Panel>
  );
}

type Contacts = {
  phone: string;
  whatsapp: string;
  email: string;
  address: L;
  hours: L;
  mapEmbedUrl: string;
  mapLink: string;
  instagram: string;
  tiktok: string;
  telegram: string;
};

export function ContactsForm({ initial }: { initial: Contacts }) {
  const t = useTranslations("admin.settings.general");
  const ts = useTranslations("admin.settings");
  const tc = useTranslations("admin.common");
  const { pending, execute, fieldError } = useAdminAction();
  const [form, setForm] = useState<Contacts>({ ...initial, phone: formatPhoneInput(initial.phone), whatsapp: formatPhoneInput(initial.whatsapp) });
  const set = (key: keyof Contacts) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });

  return (
    <Panel title={t("contacts")} serif>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void execute(() => saveContactsAction({ ...form, phone: form.phone.replace(/[^\d+]/g, ""), whatsapp: form.whatsapp.replace(/[^\d+]/g, "") }), { success: ts("saved") });
        }}
      >
        <div className="grid gap-4 md:grid-cols-3">
          <Field label={t("phone")} error={fieldError("phone")}>
            <Input inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: formatPhoneInput(e.target.value) })} />
          </Field>
          <Field label={t("whatsapp")} error={fieldError("whatsapp")}>
            <div className="relative">
              <WhatsAppIcon size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-[#25a366]" />
              <Input inputMode="tel" className="pl-9" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: formatPhoneInput(e.target.value) })} />
            </div>
          </Field>
          <Field label={t("email")} error={fieldError("email")}>
            <Input type="email" value={form.email} onChange={set("email")} />
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("addressRu")}>
            <Input value={form.address.ru} onChange={(e) => setForm({ ...form, address: { ...form.address, ru: e.target.value } })} maxLength={200} />
          </Field>
          <Field label={t("addressKk")}>
            <Input value={form.address.kk} onChange={(e) => setForm({ ...form, address: { ...form.address, kk: e.target.value } })} maxLength={200} />
          </Field>
          <Field label={t("hoursRu")}>
            <Input value={form.hours.ru} onChange={(e) => setForm({ ...form, hours: { ...form.hours, ru: e.target.value } })} maxLength={200} />
          </Field>
          <Field label={t("hoursKk")}>
            <Input value={form.hours.kk} onChange={(e) => setForm({ ...form, hours: { ...form.hours, kk: e.target.value } })} maxLength={200} />
          </Field>
          <Field label={t("mapEmbedUrl")} hint={t("mapHint")}>
            <Input value={form.mapEmbedUrl} onChange={set("mapEmbedUrl")} maxLength={1000} />
          </Field>
          <Field label={t("mapLink")}>
            <div className="flex gap-2">
              <Input value={form.mapLink} onChange={set("mapLink")} maxLength={1000} />
              {form.mapLink && (
                <Button variant="secondary" asChild>
                  <a href={form.mapLink} target="_blank" rel="noreferrer">
                    <MapPin />
                    <span className="hidden lg:inline">{t("showOnMap")}</span>
                  </a>
                </Button>
              )}
            </div>
          </Field>
        </div>
        {form.mapEmbedUrl.startsWith("https://") && (
          <iframe src={form.mapEmbedUrl} title="map" className="h-56 w-full rounded-xl border border-line" loading="lazy" />
        )}
        <p className="pt-2 text-[13px] font-semibold text-graphite">{t("socials")}</p>
        <div className="grid gap-4 md:grid-cols-3">
          {(
            [
              ["instagram", InstagramIcon],
              ["tiktok", TikTokIcon],
              ["telegram", TelegramIcon],
            ] as const
          ).map(([key, Icon]) => (
            <Field key={key} label={t(key)}>
              <div className="relative">
                <Icon size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-ink-500" />
                <Input className="pl-9" value={form[key]} onChange={set(key)} placeholder="https://" maxLength={300} />
              </div>
            </Field>
          ))}
        </div>
        <Button type="submit" loading={pending}>
          {tc("save")}
        </Button>
      </form>
    </Panel>
  );
}
