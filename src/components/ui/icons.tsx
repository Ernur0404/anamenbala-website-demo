import type { SVGProps } from "react";
import {
  Baby,
  BedDouble,
  Box,
  Briefcase,
  CookingPot,
  Droplets,
  Flame,
  Flower2,
  Gem,
  Gift,
  Heart,
  House,
  Lamp,
  Layers,
  Leaf,
  MapPin,
  Milk,
  Moon,
  Percent,
  Puzzle,
  Shirt,
  ShieldCheck,
  Sofa,
  Sparkles,
  Star,
  Store,
  Sun,
  Truck,
  Users,
  Wallet,
  Wind,
  MessageCircle,
  RefreshCcw,
  Phone,
  Mail,
  Clock,
  LayoutGrid,
  type LucideIcon,
} from "lucide-react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

/** Знак логотипа: четыре лепестка в цветах бренда */
export function LogoMark({ size = 40, ...props }: IconProps) {
  const leaf = "M0 0C-6.2-5.6-6.6-14.6 0-21.5C6.6-14.6 6.2-5.6 0 0Z";
  const vein = "M0 -2.5L0 -17";
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden {...props}>
      <g transform="translate(24 25)">
        <g transform="rotate(-40)">
          <path d={leaf} fill="#7FA68A" />
          <path d={vein} stroke="#FAF8F3" strokeWidth="1.1" strokeLinecap="round" opacity=".7" />
        </g>
        <g transform="rotate(40)">
          <path d={leaf} fill="#587E63" />
          <path d={vein} stroke="#FAF8F3" strokeWidth="1.1" strokeLinecap="round" opacity=".6" />
        </g>
        <g transform="rotate(-130)">
          <path d={leaf} fill="#C5AB85" />
          <path d={vein} stroke="#FAF8F3" strokeWidth="1.1" strokeLinecap="round" opacity=".7" />
        </g>
        <g transform="rotate(130)">
          <path d={leaf} fill="#E8B8B8" />
          <path d={vein} stroke="#FAF8F3" strokeWidth="1.1" strokeLinecap="round" opacity=".8" />
        </g>
        <circle r="2.6" fill="#FAF8F3" />
        <circle r="1.4" fill="#C5AB85" />
      </g>
    </svg>
  );
}

export function InstagramIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function TikTokIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M16.6 3c.3 2.2 1.6 3.7 3.9 3.9v3a7 7 0 0 1-3.9-1.2v6.1c0 3.5-2.6 6.2-6.1 6.2A6 6 0 0 1 4.4 15c0-3.5 2.9-6.2 6.5-5.9v3.2c-1.7-.3-3.3.9-3.3 2.7 0 1.6 1.2 2.9 2.9 2.9 1.8 0 3-1.3 3-3.2V3h3.1Z" />
    </svg>
  );
}

export function TelegramIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M20.7 4.3 3.5 11c-1.2.5-1.2 1.2-.2 1.5l4.4 1.4 1.7 5.2c.2.6.4.8.8.8.4 0 .6-.2.9-.5l2.2-2.1 4.5 3.3c.8.5 1.4.2 1.6-.8l2.9-13.7c.3-1.2-.4-1.8-1.6-1.3Zm-3.3 3.5-7.9 7.1-.3 3.3-1.4-4.5 9.2-5.8c.4-.3.8-.1.4-.1Z" />
    </svg>
  );
}

export function WhatsAppIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M12 2.2a9.7 9.7 0 0 0-8.4 14.6L2.3 21.8l5.1-1.3A9.8 9.8 0 1 0 12 2.2Zm0 17.7c-1.5 0-3-.4-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 19.9Zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8 1c-.1.2-.3.2-.5.1a6.5 6.5 0 0 1-3.2-2.8c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.4-.6 1.6-1.2.2-.6.2-1.1.1-1.2l-.8-.9Z" />
    </svg>
  );
}

/** Бейдж Kaspi (нейтральная отрисовка, не официальный логотип) */
export function KaspiBadge({ label = "Kaspi", className }: { label?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-2 py-1 text-[11px] font-bold text-graphite ${className ?? ""}`}>
      <span className="grid size-4 place-items-center rounded-[4px] bg-[#e4312b] text-[9px] font-black text-white">K</span>
      {label}
    </span>
  );
}

export function StrollerIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M4 5h2l2 8h10a6 6 0 0 0-6-6V5" />
      <path d="M8 13h10" />
      <circle cx="8.5" cy="18.5" r="1.8" />
      <circle cx="16.5" cy="18.5" r="1.8" />
    </svg>
  );
}

const ICONS: Record<string, LucideIcon> = {
  heart: Heart,
  baby: Baby,
  home: House,
  house: House,
  flower: Flower2,
  shirt: Shirt,
  milk: Milk,
  briefcase: Briefcase,
  sparkles: Sparkles,
  gem: Gem,
  toy: Puzzle,
  droplets: Droplets,
  moon: Moon,
  layers: Layers,
  box: Box,
  "cooking-pot": CookingPot,
  lamp: Lamp,
  wind: Wind,
  flame: Flame,
  gift: Gift,
  percent: Percent,
  leaf: Leaf,
  sun: Sun,
  users: Users,
  star: Star,
  truck: Truck,
  "shield-check": ShieldCheck,
  "map-pin": MapPin,
  store: Store,
  wallet: Wallet,
  sofa: Sofa,
  bed: BedDouble,
  "message-circle": MessageCircle,
  "refresh-ccw": RefreshCcw,
  phone: Phone,
  mail: Mail,
  clock: Clock,
  grid: LayoutGrid,
};

export const ICON_KEYS = [...Object.keys(ICONS), "stroller"];

/** Иконка по ключу из админки (категории, преимущества, инфо-панель) */
export function DynamicIcon({ name, className, size }: { name: string | null | undefined; className?: string; size?: number }) {
  if (name === "stroller") return <StrollerIcon className={className} size={size} />;
  const Icon = (name && ICONS[name]) || LayoutGrid;
  return <Icon className={className} size={size} aria-hidden />;
}
