import { categoryPath, isCategoryPublic, type CategoryIndex } from "./categories";
import { toImage } from "./cards";
import { tr, type Locale } from "@/lib/l10n";

export function categoryHref(index: CategoryIndex, id: string) {
  return `/catalog/${categoryPath(index, id).map((c) => c.slug).join("/")}`;
}

/** Пункты сайдбара: корневые категории, активная раскрыта до подкатегорий */
export function sidebarItems(index: CategoryIndex, locale: Locale, activeId: string | null, labels: { all: string; sale: string }) {
  const activePath = activeId ? categoryPath(index, activeId).map((c) => c.id) : [];
  const roots = (index.children.get(null) ?? []).filter((c) => isCategoryPublic(index, c.id) && c.showInMenu);
  return [
    { key: "all", label: labels.all, href: "/catalog", icon: "grid", active: activeId === null },
    ...roots.map((root) => ({
      key: root.id,
      label: tr(root, "name", locale),
      href: categoryHref(index, root.id),
      icon: root.icon,
      active: activeId === root.id,
      children: activePath.includes(root.id)
        ? (index.children.get(root.id) ?? [])
            .filter((c) => c.isVisible)
            .map((child) => ({
              key: child.id,
              label: tr(child, "name", locale),
              href: categoryHref(index, child.id),
              icon: child.icon,
              active: activeId === child.id,
            }))
        : undefined,
    })),
    { key: "sale", label: labels.sale, href: "/sale", icon: "percent", active: false, accent: "powder" as const },
  ];
}

export function childTiles(index: CategoryIndex, locale: Locale, parentId: string) {
  return (index.children.get(parentId) ?? [])
    .filter((c) => c.isVisible)
    .map((c) => {
      const label = tr(c, "name", locale);
      return { key: c.id, label, href: categoryHref(index, c.id), icon: c.icon, image: toImage(c.tileImage, label) };
    });
}
