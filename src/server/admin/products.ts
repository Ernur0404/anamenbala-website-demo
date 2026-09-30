import { db } from "../db";
import type { Prisma } from "@/generated/prisma/client";
import type { ProductStatus } from "@/generated/prisma/enums";
import { mediaSelect } from "../media/refs";
import { getCategoryIndex, descendantIds } from "../catalog/categories";
import { getSetting } from "../settings";
import { searchTokens } from "@/lib/search";

export const PRODUCT_PAGE_SIZE = 20;
export const PRODUCT_SORTS = ["new", "old", "name", "priceAsc", "priceDesc", "stockAsc", "sales"] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export type ProductListFilters = {
  q?: string;
  categoryId?: string;
  status?: ProductStatus;
  stock?: "in" | "low" | "out";
  brandId?: string;
  sort?: ProductSort;
};

const ORDER: Record<ProductSort, Prisma.ProductOrderByWithRelationInput[]> = {
  new: [{ createdAt: "desc" }],
  old: [{ createdAt: "asc" }],
  name: [{ nameRu: "asc" }],
  priceAsc: [{ priceMin: "asc" }],
  priceDesc: [{ priceMin: "desc" }],
  stockAsc: [{ totalStock: "asc" }],
  sales: [{ salesCount: "desc" }],
};

export async function productWhere(f: ProductListFilters): Promise<Prisma.ProductWhereInput> {
  const and: Prisma.ProductWhereInput[] = [];
  if (f.status) and.push({ status: f.status });
  if (f.brandId) and.push({ brandId: f.brandId });
  if (f.categoryId) {
    const index = await getCategoryIndex();
    and.push({ categories: { some: { categoryId: { in: descendantIds(index, f.categoryId) } } } });
  }
  if (f.stock === "in") and.push({ inStock: true });
  if (f.stock === "out") and.push({ inStock: false });
  if (f.stock === "low") {
    const threshold = (await getSetting("general")).lowStockThreshold;
    and.push({ inStock: true, variants: { some: { isActive: true, stock: { lte: threshold } } } });
  }
  const q = f.q?.trim();
  if (q) {
    const tokens = searchTokens(q);
    and.push({
      OR: [
        ...(tokens.length ? [{ AND: tokens.map((t) => ({ searchText: { contains: t } })) }] : []),
        { variants: { some: { OR: [{ sku: { contains: q, mode: "insensitive" as const } }, { barcode: q }] } } },
      ],
    });
  }
  return and.length ? { AND: and } : {};
}

export async function listAdminProducts(filters: ProductListFilters, page: number, pageSize = PRODUCT_PAGE_SIZE) {
  const where = await productWhere(filters);
  const [rows, total, threshold] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: [...ORDER[filters.sort ?? "new"], { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        slug: true,
        nameRu: true,
        status: true,
        priceMin: true,
        priceMax: true,
        regularMin: true,
        discountPercent: true,
        totalStock: true,
        inStock: true,
        allowBackorder: true,
        isDemo: true,
        primaryCategory: { select: { nameRu: true } },
        categories: { take: 1, select: { category: { select: { nameRu: true } } } },
        media: { take: 1, orderBy: { sortOrder: "asc" }, select: { media: { select: mediaSelect } } },
        variants: { where: { isActive: true }, select: { stock: true } },
      },
    }),
    db.product.count({ where }),
    getSetting("general").then((g) => g.lowStockThreshold),
  ]);
  return { rows, total, threshold };
}

/** Всё для формы товара: сам товар со связями */
export async function getProductForEdit(id: string) {
  return db.product.findUnique({
    where: { id },
    include: {
      categories: { select: { categoryId: true } },
      badges: { select: { badgeId: true } },
      attributeValues: { select: { attributeValueId: true } },
      specs: { orderBy: { sortOrder: "asc" } },
      options: { orderBy: { sortOrder: "asc" }, select: { attributeId: true } },
      variants: {
        orderBy: { sortOrder: "asc" },
        include: { optionValues: { select: { attributeId: true, attributeValueId: true } }, _count: { select: { orderItems: true } } },
      },
      media: { orderBy: { sortOrder: "asc" }, include: { media: { select: mediaSelect } } },
      videoMedia: { select: mediaSelect },
    },
  });
}

export type ProductForEdit = NonNullable<Awaited<ReturnType<typeof getProductForEdit>>>;

/** Справочники для формы: категории с характеристиками, характеристики со значениями, бренды, метки, таблицы размеров */
export async function productFormOptions() {
  const [categories, attributes, brands, badges, sizeCharts] = await Promise.all([
    db.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { nameRu: "asc" }],
      select: { id: true, parentId: true, nameRu: true, nameKk: true, isVisible: true, sizeChartId: true, attributes: { select: { attributeId: true, isFilter: true, sortOrder: true } } },
    }),
    db.attribute.findMany({
      orderBy: [{ sortOrder: "asc" }, { nameRu: "asc" }],
      select: {
        id: true,
        code: true,
        nameRu: true,
        nameKk: true,
        type: true,
        display: true,
        isVariantAxis: true,
        unit: true,
        values: { orderBy: [{ sortOrder: "asc" }, { valueRu: "asc" }], select: { id: true, slug: true, valueRu: true, valueKk: true, colorHex: true } },
      },
    }),
    db.brand.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    db.badge.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, nameRu: true, style: true } }),
    db.sizeChart.findMany({ orderBy: { nameRu: "asc" }, select: { id: true, nameRu: true } }),
  ]);
  return { categories, attributes, brands, badges, sizeCharts };
}

export type ProductFormOptions = Awaited<ReturnType<typeof productFormOptions>>;
