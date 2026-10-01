"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ExternalLink, Info, Plus, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { ICON_KEYS } from "@/components/ui/icons";
import { Panel } from "@/components/admin/ui";
import { ImageField } from "@/components/admin/media";
import { RichTextEditor } from "@/components/admin/rich-text";
import { ConfirmButton } from "@/components/admin/controls";
import { useAdminAction } from "@/components/admin/use-action";
import { deletePageAction, savePageAction } from "@/server/actions/admin/content";
import { slugify } from "@/lib/slug";
import { cn } from "@/lib/utils";

type Img = { id: string; url: string | null } | null;
type L = { ru: string; kk: string };
export type AboutState = {
  intro: L;
  features: { icon: string; title: L }[];
  valuesTitle: L;
  values: { icon: string; title: L; text: L }[];
  quote: L;
  storyTitle: L;
  story: L;
  valuesImage: Img;
  storyImage: Img;
};
type Form = {
  id: string | null;
  template: "DEFAULT" | "ABOUT" | "DELIVERY" | "CONTACTS" | "FAQ" | "HERO_ONLY";
  isSystem: boolean;
  slug: string;
  titleRu: string;
  titleKk: string;
  subtitleRu: string;
  subtitleKk: string;
  scriptRu: string;
  scriptKk: string;
  heroImage: Img;
  bodyRu: string;
  bodyKk: string;
  isPublished: boolean;
  showInFooter: boolean;
  seoTitleRu: string;
  seoTitleKk: string;
  seoDescriptionRu: string;
  seoDescriptionKk: string;
  about: AboutState | null;
};

function LocalizedPair({ label, value, onChange, area, max = 400 }: { label: string; value: L; onChange: (v: L) => void; area?: boolean; max?: number }) {
  const C = area ? Textarea : Input;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={`${label} (RU)`}>
        <C value={value.ru} maxLength={max} onChange={(e: { target: { value: string } }) => onChange({ ...value, ru: e.target.value })} {...(area ? { rows: 3 } : {})} />
      </Field>
      <Field label={`${label} (KZ)`}>
        <C value={value.kk} maxLength={max} onChange={(e: { target: { value: string } }) => onChange({ ...value, kk: e.target.value })} {...(area ? { rows: 3 } : {})} />
      </Field>
    </div>
  );
}

export function PageForm({ initial, path }: { initial: Form; path: string | null }) {
  const t = useTranslations("admin.content.pages");
  const tc = useTranslations("admin.common");
  const router = useRouter();
  const { pending, execute, fieldError } = useAdminAction();
  const [form, setForm] = useState<Form>(initial);
  const [bodyLang, setBodyLang] = useState<"ru" | "kk">("ru");
  const heroOnly = form.template === "HERO_ONLY";
  const hasBody = form.template === "DEFAULT";
  const about = form.about;
  const setAbout = (patch: Partial<AboutState>) => setForm((f) => ({ ...f, about: f.about ? { ...f.about, ...patch } : f.about }));

  const save = () =>
    execute(
      () =>
        savePageAction({
          ...form,
          heroImageId: form.heroImage?.id ?? null,
          content: about
            ? {
                intro: about.intro,
                features: about.features,
                valuesTitle: about.valuesTitle,
                values: about.values,
                quote: about.quote,
                storyTitle: about.storyTitle,
                story: about.story,
                valuesImageId: about.valuesImage?.id ?? null,
                storyImageId: about.storyImage?.id ?? null,
              }
            : null,
        }),
      {
        success: tc("saved"),
        onSuccess: (d) => {
          if (!form.id) router.replace(`/admin/content/pages/${d.id}`);
        },
      },
    );

  const text = (key: "titleRu" | "titleKk" | "subtitleRu" | "subtitleKk" | "scriptRu" | "scriptKk", area = false, max = 400) => (
    <Field label={t(`fields.${key}`)} error={fieldError(key)} required={key === "titleRu"}>
      {area ? (
        <Textarea rows={2} value={form[key]} maxLength={max} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
      ) : (
        <Input value={form[key]} maxLength={max} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
      )}
    </Field>
  );

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-5">
        {(form.template === "DELIVERY" || form.template === "CONTACTS" || form.template === "FAQ") && (
          <p className="flex items-start gap-2 rounded-xl bg-sage-50 px-4 py-3 text-[13px] text-sage-900">
            <Info className="mt-0.5 size-4 shrink-0 text-sage-700" />
            {t(`templateNote.${form.template}`)}
          </p>
        )}
        <Panel>
          <div className="grid gap-4 md:grid-cols-2">
            {text("titleRu", false, 160)}
            {text("titleKk", false, 160)}
            {text("subtitleRu", true)}
            {text("subtitleKk", true)}
            {text("scriptRu", false, 80)}
            {text("scriptKk", false, 80)}
          </div>
        </Panel>

        {hasBody && (
          <Panel
            title={bodyLang === "ru" ? t("fields.bodyRu") : t("fields.bodyKk")}
            action={
              <div className="inline-flex rounded-full bg-cream-200 p-0.5 text-[12px] font-semibold">
                {(["ru", "kk"] as const).map((lng) => (
                  <button key={lng} type="button" onClick={() => setBodyLang(lng)} className={cn("rounded-full px-3 py-1", bodyLang === lng ? "bg-white text-sage-800 shadow-soft" : "text-ink-500")}>
                    {lng === "ru" ? "RU" : "KZ"}
                  </button>
                ))}
              </div>
            }
          >
            {bodyLang === "ru" ? (
              <RichTextEditor key="ru" value={form.bodyRu} onChange={(bodyRu) => setForm((f) => ({ ...f, bodyRu }))} minHeight={320} />
            ) : (
              <RichTextEditor key="kk" value={form.bodyKk} onChange={(bodyKk) => setForm((f) => ({ ...f, bodyKk }))} minHeight={320} />
            )}
          </Panel>
        )}

        {about && (
          <>
            <Panel>
              <LocalizedPair label={t("about.intro")} value={about.intro} onChange={(intro) => setAbout({ intro })} area max={800} />
            </Panel>
            <Panel title={t("about.features")}>
              <div className="space-y-3">
                {about.features.map((f, i) => (
                  <div key={i} className="grid items-end gap-3 rounded-lg border border-line p-3 sm:grid-cols-[150px_1fr_1fr_auto]">
                    <Field label={t("about.icon")}>
                      <Select value={f.icon} onChange={(e) => setAbout({ features: about.features.map((x, j) => (j === i ? { ...x, icon: e.target.value } : x)) })}>
                        {ICON_KEYS.map((k) => (
                          <option key={k} value={k}>
                            {k}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="RU">
                      <Input value={f.title.ru} onChange={(e) => setAbout({ features: about.features.map((x, j) => (j === i ? { ...x, title: { ...x.title, ru: e.target.value } } : x)) })} />
                    </Field>
                    <Field label="KZ">
                      <Input value={f.title.kk} onChange={(e) => setAbout({ features: about.features.map((x, j) => (j === i ? { ...x, title: { ...x.title, kk: e.target.value } } : x)) })} />
                    </Field>
                    <button type="button" onClick={() => setAbout({ features: about.features.filter((_, j) => j !== i) })} className="mb-1 grid size-9 place-items-center rounded-md text-ink-400 hover:bg-powder-50 hover:text-powder-800" aria-label={tc("remove")}>
                      <Trash className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
              <Button size="sm" variant="soft" className="mt-3" onClick={() => setAbout({ features: [...about.features, { icon: "heart", title: { ru: "", kk: "" } }] })}>
                <Plus />
                {t("about.addItem")}
              </Button>
            </Panel>
            <Panel title={t("about.values")}>
              <LocalizedPair label={t("about.valuesTitle")} value={about.valuesTitle} onChange={(valuesTitle) => setAbout({ valuesTitle })} max={120} />
              <div className="mt-4 space-y-3">
                {about.values.map((v, i) => (
                  <div key={i} className="space-y-3 rounded-lg border border-line p-3">
                    <div className="flex items-end gap-3">
                      <Field label={t("about.icon")} className="w-44">
                        <Select value={v.icon} onChange={(e) => setAbout({ values: about.values.map((x, j) => (j === i ? { ...x, icon: e.target.value } : x)) })}>
                          {ICON_KEYS.map((k) => (
                            <option key={k} value={k}>
                              {k}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <button type="button" onClick={() => setAbout({ values: about.values.filter((_, j) => j !== i) })} className="ml-auto grid size-9 place-items-center rounded-md text-ink-400 hover:bg-powder-50 hover:text-powder-800" aria-label={tc("remove")}>
                        <Trash className="size-4" />
                      </button>
                    </div>
                    <LocalizedPair label={t("about.itemTitle")} value={v.title} onChange={(title) => setAbout({ values: about.values.map((x, j) => (j === i ? { ...x, title } : x)) })} max={80} />
                    <LocalizedPair label={t("about.itemText")} value={v.text} onChange={(textValue) => setAbout({ values: about.values.map((x, j) => (j === i ? { ...x, text: textValue } : x)) })} area max={300} />
                  </div>
                ))}
              </div>
              <Button size="sm" variant="soft" className="mt-3" onClick={() => setAbout({ values: [...about.values, { icon: "heart", title: { ru: "", kk: "" }, text: { ru: "", kk: "" } }] })}>
                <Plus />
                {t("about.addItem")}
              </Button>
              <div className="mt-5 grid gap-4 md:grid-cols-[240px_1fr]">
                <div>
                  <p className="mb-1.5 text-[13px] font-medium text-ink-700">{t("about.valuesImage")}</p>
                  <ImageField value={about.valuesImage} onChange={(valuesImage) => setAbout({ valuesImage })} aspect="aspect-[4/5]" />
                </div>
                <LocalizedPair label={t("about.quote")} value={about.quote} onChange={(quote) => setAbout({ quote })} area max={200} />
              </div>
            </Panel>
            <Panel title={t("about.storyTitle")}>
              <LocalizedPair label={t("about.storyTitle")} value={about.storyTitle} onChange={(storyTitle) => setAbout({ storyTitle })} max={120} />
              <div className="mt-4">
                <LocalizedPair label={t("about.story")} value={about.story} onChange={(story) => setAbout({ story })} area max={4000} />
              </div>
              <div className="mt-4 max-w-md">
                <p className="mb-1.5 text-[13px] font-medium text-ink-700">{t("about.storyImage")}</p>
                <ImageField value={about.storyImage} onChange={(storyImage) => setAbout({ storyImage })} aspect="aspect-[16/10]" />
              </div>
            </Panel>
          </>
        )}

        {!heroOnly && (
          <Panel title={tc("seo")}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label={`${tc("seoTitle")} (RU)`}>
                <Input value={form.seoTitleRu} maxLength={200} onChange={(e) => setForm({ ...form, seoTitleRu: e.target.value })} />
              </Field>
              <Field label={`${tc("seoTitle")} (KZ)`}>
                <Input value={form.seoTitleKk} maxLength={200} onChange={(e) => setForm({ ...form, seoTitleKk: e.target.value })} />
              </Field>
              <Field label={`${tc("seoDescription")} (RU)`}>
                <Textarea rows={2} value={form.seoDescriptionRu} maxLength={400} onChange={(e) => setForm({ ...form, seoDescriptionRu: e.target.value })} />
              </Field>
              <Field label={`${tc("seoDescription")} (KZ)`}>
                <Textarea rows={2} value={form.seoDescriptionKk} maxLength={400} onChange={(e) => setForm({ ...form, seoDescriptionKk: e.target.value })} />
              </Field>
            </div>
          </Panel>
        )}
      </div>

      <div className="space-y-5 xl:sticky xl:top-24">
        <Panel>
          <div className="space-y-3">
            {!form.isSystem && (
              <Field label={t("fields.slug")} hint={tc("slugHint")} error={fieldError("slug")}>
                <div className="flex items-center rounded-md border border-line-strong bg-white focus-within:border-sage-500">
                  <span className="pl-3 text-[13px] text-ink-400">/p/</span>
                  <input
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
                    onBlur={() => !form.slug && form.titleRu && setForm((f) => ({ ...f, slug: slugify(f.titleRu) }))}
                    className="h-11 w-full min-w-0 bg-transparent pr-3 text-[14px] outline-none"
                    maxLength={80}
                    aria-label={t("fields.slug")}
                  />
                </div>
              </Field>
            )}
            {!heroOnly && <Checkbox label={t("fields.isPublished")} checked={form.isPublished} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} />}
            {hasBody && <Checkbox label={t("fields.showInFooter")} checked={form.showInFooter} onChange={(e) => setForm({ ...form, showInFooter: e.target.checked })} />}
          </div>
          <Button block className="mt-5" loading={pending} disabled={!form.titleRu.trim()} onClick={() => void save()}>
            {tc("save")}
          </Button>
          {path && (
            <a href={path} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-sage-700 hover:underline">
              <ExternalLink className="size-3.5" />
              {t("open")}
            </a>
          )}
          {form.id && !form.isSystem && (
            <ConfirmButton
              title={t("deleteTitle", { title: form.titleRu })}
              confirmLabel={tc("delete")}
              variant="ghost"
              className="mt-2 w-full text-powder-800"
              onConfirm={() => execute(() => deletePageAction({ id: form.id! }), { success: tc("deleted"), onSuccess: () => router.push("/admin/content/pages") })}
            >
              {tc("delete")}
            </ConfirmButton>
          )}
        </Panel>
        <Panel title={t("fields.heroImage")}>
          <ImageField value={form.heroImage} onChange={(heroImage) => setForm({ ...form, heroImage })} aspect="aspect-[16/7]" />
        </Panel>
      </div>
    </div>
  );
}
