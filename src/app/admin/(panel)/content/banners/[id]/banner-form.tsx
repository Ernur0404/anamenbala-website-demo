"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowRight, Heart, Plus, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { DynamicIcon, ICON_KEYS } from "@/components/ui/icons";
import { Panel } from "@/components/admin/ui";
import { ImageField } from "@/components/admin/media";
import { ConfirmButton } from "@/components/admin/controls";
import { useAdminAction } from "@/components/admin/use-action";
import { deleteBannerAction, saveBannerAction } from "@/server/actions/admin/content";

type Img = { id: string; url: string | null } | null;
type Form = {
  id: string | null;
  placement: "HOME_HERO" | "HOME_PROMO";
  eyebrowRu: string;
  eyebrowKk: string;
  titleRu: string;
  titleKk: string;
  textRu: string;
  textKk: string;
  scriptRu: string;
  scriptKk: string;
  buttonTextRu: string;
  buttonTextKk: string;
  url: string;
  image: Img;
  mobileImage: Img;
  features: { icon: string; ru: string; kk: string }[];
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};
type TextKey = "eyebrowRu" | "eyebrowKk" | "titleRu" | "titleKk" | "textRu" | "textKk" | "scriptRu" | "scriptKk" | "buttonTextRu" | "buttonTextKk" | "url";

export function BannerForm({ initial }: { initial: Form }) {
  const t = useTranslations("admin.content.banners");
  const tc = useTranslations("admin.common");
  const router = useRouter();
  const { pending, execute, fieldError } = useAdminAction();
  const [form, setForm] = useState<Form>(initial);
  const field = (key: TextKey, opts: { area?: boolean; max: number; hint?: string }) => (
    <Field label={t(`fields.${key}`)} error={fieldError(key)} hint={opts.hint}>
      {opts.area ? (
        <Textarea rows={2} value={form[key]} maxLength={opts.max} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
      ) : (
        <Input value={form[key]} maxLength={opts.max} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
      )}
    </Field>
  );

  const save = () =>
    execute(
      () => saveBannerAction({ ...form, imageId: form.image?.id ?? null, mobileImageId: form.mobileImage?.id ?? null, startsAt: form.startsAt || null, endsAt: form.endsAt || null }),
      {
        success: tc("saved"),
        onSuccess: (d) => {
          if (!form.id) router.replace(`/admin/content/banners/${d.id}`);
        },
      },
    );

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-5">
        {/* превью как на сайте */}
        <div className="relative h-56 overflow-hidden rounded-2xl bg-beige-100 sm:h-72">
          {form.image?.url && (
            // eslint-disable-next-line @next/next/no-img-element -- превью баннера
            <img src={form.image.url} alt="" className="absolute inset-0 size-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-cream via-cream/80 to-transparent [background-size:70%_100%] bg-no-repeat" />
          {form.scriptRu && (
            <p className="script-accent absolute top-5 right-6 hidden max-w-[200px] rotate-[-4deg] text-right text-[22px] text-graphite/80 md:block">
              {form.scriptRu}
              <Heart className="mt-1 ml-auto size-4 stroke-[1.4]" />
            </p>
          )}
          <div className="absolute inset-y-0 left-0 flex max-w-[60%] flex-col justify-center p-6 sm:p-10">
            {form.eyebrowRu && <p className="mb-2 text-[11px] font-bold tracking-[0.18em] text-sage-700 uppercase">{form.eyebrowRu}</p>}
            <p className="heading-display text-[28px] text-graphite sm:text-[40px]">{form.titleRu || "…"}</p>
            {form.textRu && <p className="mt-2 text-[13px] text-ink-700">{form.textRu}</p>}
            {form.buttonTextRu && (
              <span className="mt-4 inline-flex h-10 w-fit items-center gap-2 rounded-lg bg-sage-700 px-4 text-[13px] font-semibold text-white">
                {form.buttonTextRu}
                <ArrowRight className="size-4" />
              </span>
            )}
          </div>
        </div>

        <Panel>
          <div className="grid gap-4 md:grid-cols-2">
            {field("titleRu", { max: 160 })}
            {field("titleKk", { max: 160 })}
            {field("eyebrowRu", { max: 80 })}
            {field("eyebrowKk", { max: 80 })}
            {field("textRu", { area: true, max: 400 })}
            {field("textKk", { area: true, max: 400 })}
            {field("scriptRu", { max: 80 })}
            {field("scriptKk", { max: 80 })}
            {field("buttonTextRu", { max: 40 })}
            {field("buttonTextKk", { max: 40 })}
            <div className="md:col-span-2">{field("url", { max: 300, hint: t("fields.urlHint") })}</div>
          </div>
        </Panel>

        {form.placement === "HOME_PROMO" && (
          <Panel title={t("fields.features")}>
            <div className="space-y-2">
              {form.features.map((f, i) => (
                <div key={i} className="grid items-center gap-2 sm:grid-cols-[140px_1fr_1fr_auto]">
                  <Select value={f.icon} onChange={(e) => setForm({ ...form, features: form.features.map((x, j) => (j === i ? { ...x, icon: e.target.value } : x)) })} className="h-10">
                    {ICON_KEYS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </Select>
                  <Input className="h-10" value={f.ru} placeholder={t("fields.featureRu")} onChange={(e) => setForm({ ...form, features: form.features.map((x, j) => (j === i ? { ...x, ru: e.target.value } : x)) })} maxLength={60} />
                  <Input className="h-10" value={f.kk} placeholder={t("fields.featureKk")} onChange={(e) => setForm({ ...form, features: form.features.map((x, j) => (j === i ? { ...x, kk: e.target.value } : x)) })} maxLength={60} />
                  <button type="button" onClick={() => setForm({ ...form, features: form.features.filter((_, j) => j !== i) })} className="grid size-10 place-items-center rounded-md text-ink-400 hover:bg-powder-50 hover:text-powder-800" aria-label={tc("remove")}>
                    <Trash className="size-4" />
                  </button>
                </div>
              ))}
            </div>
            {form.features.length < 6 && (
              <Button size="sm" variant="soft" className="mt-3" onClick={() => setForm({ ...form, features: [...form.features, { icon: "heart", ru: "", kk: "" }] })}>
                <Plus />
                {t("fields.addFeature")}
              </Button>
            )}
            <div className="mt-3 flex flex-wrap gap-4 text-ink-500">
              {form.features.map((f, i) => (
                <span key={i} className="flex items-center gap-1.5 text-[12.5px]">
                  <DynamicIcon name={f.icon} size={16} />
                  {f.ru}
                </span>
              ))}
            </div>
          </Panel>
        )}
      </div>

      <div className="space-y-5 xl:sticky xl:top-24">
        <Panel>
          <Checkbox label={t("fields.isActive")} checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Field label={t("fields.startsAt")}>
              <Input type="date" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
            </Field>
            <Field label={t("fields.endsAt")}>
              <Input type="date" value={form.endsAt} min={form.startsAt || undefined} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
            </Field>
          </div>
          <Button block className="mt-5" loading={pending} disabled={!form.titleRu.trim()} onClick={() => void save()}>
            {tc("save")}
          </Button>
          {form.id && (
            <ConfirmButton
              title={t("deleteTitle", { title: form.titleRu })}
              confirmLabel={tc("delete")}
              variant="ghost"
              className="mt-2 w-full text-powder-800"
              onConfirm={() => execute(() => deleteBannerAction({ id: form.id! }), { success: tc("deleted"), onSuccess: () => router.push("/admin/content") })}
            >
              {tc("delete")}
            </ConfirmButton>
          )}
        </Panel>
        <Panel title={t("fields.image")}>
          <ImageField value={form.image} onChange={(image) => setForm({ ...form, image })} aspect="aspect-[16/7]" />
        </Panel>
        <Panel title={t("fields.mobileImage")} subtitle={tc("mobileImageHint")}>
          <ImageField value={form.mobileImage} onChange={(mobileImage) => setForm({ ...form, mobileImage })} aspect="aspect-[4/5]" className="mx-auto max-w-[220px]" />
        </Panel>
      </div>
    </div>
  );
}
