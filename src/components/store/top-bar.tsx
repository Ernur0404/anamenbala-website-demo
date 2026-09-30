import { DynamicIcon } from "@/components/ui/icons";

export function TopBar({ items }: { items: { icon: string; text: string }[] }) {
  if (!items.length) return null;
  return (
    <div className="bg-sage-700 text-white">
      <div className="container-page flex h-9 items-center justify-center text-[12px] font-semibold tracking-[0.01em] lg:justify-between">
        {items.map((item, i) => (
          <span key={i} className={i === 0 ? "flex items-center gap-2" : "hidden items-center gap-2 lg:flex"}>
            <DynamicIcon name={item.icon} className="size-4 opacity-90" />
            {item.text}
          </span>
        ))}
      </div>
    </div>
  );
}
