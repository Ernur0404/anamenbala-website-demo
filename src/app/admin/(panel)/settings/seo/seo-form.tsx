"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Panel } from "@/components/admin/ui";
import { ImageField } from "@/components/admin/media";
import { useAdminAction } from "@/components/admin/use-action";
import { saveSeoAction } from "@/server/actions/admin/settings";

type L = { ru: string; kk: string };

export function SeoForm({ initial }: { initial: { title: L; description: L; keywords: L; og: { id: string; url: string | null } | null } }) {
  const t = useTranslations("admin.settings");
  const tc = useTranslations("admin.common");
  const { pending, execute } = useAdminAction();
  const [form, setForm] = useState(initial);
  const pair = (key: "title" | "description" | "keywords", ru: string, kk: string, area = false, max = 200) => (
    <div className="grid gap-4 md:grid-cols-2">
      {(["ru", "kk"] as const).map((l) => (
        <Field key={l} label={t(l === "ru" ? ru : kk)} hint={key === "keywords" ? t("seo.keywordsHint") : `${form[key][l].length}/${max}`}>
          {area ? (
            <Textarea rows={3} value={form[key][l]} maxLength={max} onChange={(e) => setForm({ ...form, [key]: { ...form[key], [l]: e.target.value } })} />
          ) : (
            <Input value={form[key][l]} maxLength={max} onChange={(e) => setForm({ ...form, [key]: { ...form[key], [l]: e.target.value } })} />
          )}
        </Field>
      ))}
    </div>
  );
  return (
    <Panel title={t("seo.title")} serif>
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void execute(() => saveSeoAction({ title: form.title, description: form.description, keywords: form.keywords, ogImageMediaId: form.og?.id ?? null }), { success: t("saved") });
        }}
      >
        {pair("title", "seo.metaTitleRu", "seo.metaTitleKk", false, 70)}
        {pair("description", "seo.metaDescriptionRu", "seo.metaDescriptionKk", true, 170)}
        {pair("keywords", "seo.keywordsRu", "seo.keywordsKk", false, 300)}
        <div className="max-w-md">
          <p className="mb-1.5 text-[13px] font-medium text-ink-700">{t("seo.ogImage")}</p>
          <ImageField value={form.og} onChange={(og) => setForm({ ...form, og })} aspect="aspect-[1200/630]" hint={t("seo.ogHint")} />
        </div>
        <Button type="submit" loading={pending}>
          {tc("save")}
        </Button>
      </form>
    </Panel>
  );
}
