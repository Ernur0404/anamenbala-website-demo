"use client";

import { Select } from "@/components/ui/form";
import { DynamicIcon, ICON_KEYS } from "@/components/ui/icons";

/** Выбор иконки из набора сайта (инфо-панель, преимущества, способы доставки) */
export function IconSelect({ value, onChange, id }: { value: string; onChange: (v: string) => void; id?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-sage-50 text-sage-700">
        <DynamicIcon name={value} size={18} />
      </span>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="h-10 text-[13px]" wrapperClassName="w-36">
        {ICON_KEYS.map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
      </Select>
    </div>
  );
}
