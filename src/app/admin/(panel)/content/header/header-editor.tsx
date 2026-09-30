"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { DynamicIcon, ICON_KEYS } from "@/components/ui/icons";
import { Panel } from "@/components/admin/ui";
import { useAdminAction } from "@/components/admin/use-action";
import { saveAdvantagesAction, saveTopbarAction } from "@/server/actions/admin/content";

type L = { ru: string; kk: string };
type TopItem = { icon: string; text: L };
type AdvItem = { icon: string; title: L; text: L };

function IconSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-sage-50 text-sage-700">
        <DynamicIcon name={value} size={18} />
      </span>
      <Select value={value} onChange={(e) => onChange(e.target.value)} className="h-10 text-[13px]" wrapperClassName="w-36">
        {ICON_KEYS.map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
      </Select>
    </div>
  );
}

export function HeaderEditor({ topbar, advantages }: { topbar: TopItem[]; advantages: AdvItem[] }) {
  const t = useTranslations("admin.content.header");
  const tc = useTranslations("admin.common");
  const { pending, execute } = useAdminAction();
  const [top, setTop] = useState(topbar);
  const [adv, setAdv] = useState(advantages);

  return (
    <div className="space-y-5">
      <Panel title={t("topbar")} subtitle={t("topbarHint")} serif>
        {/* превью полосы */}
        <div className="mb-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-1 rounded-lg bg-sage-700 px-4 py-2 text-[12.5px] font-semibold text-white">
          {top.map((i, n) => (
            <span key={n} className="flex items-center gap-1.5">
              <DynamicIcon name={i.icon} size={15} />
              {i.text.ru}
            </span>
          ))}
        </div>
        <div className="space-y-2">
          {top.map((item, i) => (
            <div key={i} className="grid items-center gap-2 lg:grid-cols-[auto_1fr_1fr_auto]">
              <IconSelect value={item.icon} onChange={(icon) => setTop(top.map((x, j) => (j === i ? { ...x, icon } : x)))} />
              <Input className="h-10" value={item.text.ru} placeholder={t("textRu")} onChange={(e) => setTop(top.map((x, j) => (j === i ? { ...x, text: { ...x.text, ru: e.target.value } } : x)))} maxLength={80} />
              <Input className="h-10" value={item.text.kk} placeholder={t("textKk")} onChange={(e) => setTop(top.map((x, j) => (j === i ? { ...x, text: { ...x.text, kk: e.target.value } } : x)))} maxLength={80} />
              <button type="button" onClick={() => setTop(top.filter((_, j) => j !== i))} className="grid size-10 place-items-center rounded-md text-ink-400 hover:bg-powder-50 hover:text-powder-800" aria-label={tc("remove")}>
                <Trash className="size-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {top.length < 5 && (
            <Button size="sm" variant="soft" onClick={() => setTop([...top, { icon: "heart", text: { ru: "", kk: "" } }])}>
              <Plus />
              {t("add")}
            </Button>
          )}
          <Button size="sm" loading={pending} onClick={() => void execute(() => saveTopbarAction({ items: top }), { success: tc("saved") })}>
            {tc("save")}
          </Button>
        </div>
      </Panel>

      <Panel title={t("advantages")} subtitle={t("advantagesHint")} serif>
        <div className="space-y-3">
          {adv.map((item, i) => (
            <div key={i} className="grid items-center gap-2 rounded-lg border border-line p-3 lg:grid-cols-[auto_1fr_1fr_auto]">
              <IconSelect value={item.icon} onChange={(icon) => setAdv(adv.map((x, j) => (j === i ? { ...x, icon } : x)))} />
              <div className="space-y-2">
                <Input className="h-10" value={item.title.ru} placeholder={t("titleRu")} onChange={(e) => setAdv(adv.map((x, j) => (j === i ? { ...x, title: { ...x.title, ru: e.target.value } } : x)))} maxLength={60} />
                <Input className="h-10" value={item.text.ru} placeholder={t("descRu")} onChange={(e) => setAdv(adv.map((x, j) => (j === i ? { ...x, text: { ...x.text, ru: e.target.value } } : x)))} maxLength={80} />
              </div>
              <div className="space-y-2">
                <Input className="h-10" value={item.title.kk} placeholder={t("titleKk")} onChange={(e) => setAdv(adv.map((x, j) => (j === i ? { ...x, title: { ...x.title, kk: e.target.value } } : x)))} maxLength={60} />
                <Input className="h-10" value={item.text.kk} placeholder={t("descKk")} onChange={(e) => setAdv(adv.map((x, j) => (j === i ? { ...x, text: { ...x.text, kk: e.target.value } } : x)))} maxLength={80} />
              </div>
              <button type="button" onClick={() => setAdv(adv.filter((_, j) => j !== i))} className="grid size-10 place-items-center rounded-md text-ink-400 hover:bg-powder-50 hover:text-powder-800" aria-label={tc("remove")}>
                <Trash className="size-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {adv.length < 6 && (
            <Button size="sm" variant="soft" onClick={() => setAdv([...adv, { icon: "heart", title: { ru: "", kk: "" }, text: { ru: "", kk: "" } }])}>
              <Plus />
              {t("add")}
            </Button>
          )}
          <Button size="sm" loading={pending} onClick={() => void execute(() => saveAdvantagesAction({ items: adv }), { success: tc("saved") })}>
            {tc("save")}
          </Button>
        </div>
      </Panel>
    </div>
  );
}
