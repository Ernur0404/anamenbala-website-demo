import type { ImageData } from "@/server/catalog/cards";

export type MenuCategory = {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  href: string;
  image: ImageData | null;
  children: { id: string; slug: string; name: string; icon: string | null; href: string; image: ImageData | null }[];
};

export type ChromeContacts = {
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  hours: string;
  instagram: string;
  tiktok: string;
  telegram: string;
};
