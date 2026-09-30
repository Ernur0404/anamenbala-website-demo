"use server";

import { z } from "zod";
import { adminAction } from "@/server/admin/action";
import { db } from "@/server/db";
import { DomainError } from "@/server/errors";
import { can } from "@/server/permissions";
import { productWhere } from "@/server/admin/products";
import { mediaSelect } from "@/server/media/refs";
import { mediaUrl } from "@/lib/media-url";
import { deleteProducts, duplicateProduct, productSaveSchema, saveProduct, setProductsStatus } from "@/server/admin/product-save";

export const saveProductAction = adminAction("products", productSaveSchema, async (input, actor) => saveProduct(input, actor));

const ids = z.array(z.string().min(1)).min(1).max(500);

export const bulkProductsAction = adminAction(
  "products",
  z.object({ ids, action: z.enum(["publish", "hide", "draft", "delete"]) }),
  async ({ ids, action }, actor) => {
    if (action === "delete") return { ...(await deleteProducts(ids, actor)), count: ids.length };
    const status = action === "publish" ? "PUBLISHED" : action === "hide" ? "HIDDEN" : "DRAFT";
    return { ...(await setProductsStatus(ids, status, actor)), deleted: 0, hidden: 0 };
  },
);

export const deleteProductAction = adminAction("products", z.object({ id: z.string().min(1) }), async ({ id }, actor) => deleteProducts([id], actor));

export const duplicateProductAction = adminAction("products", z.object({ id: z.string().min(1) }), async ({ id }, actor) => duplicateProduct(id, actor), { refresh: false });

/** Поиск товаров для выбора в акциях, промокодах, подборках главной */
export const lookupProductsAction = adminAction(
  null,
  z.object({ q: z.string().trim().min(1).max(100) }),
  async ({ q }, actor) => {
    if (!(["products", "promotions", "content", "orders"] as const).some((p) => can(actor.role, p))) throw new DomainError("FORBIDDEN");
    const where = await productWhere({ q });
    const rows = await db.product.findMany({
      where,
      take: 20,
      orderBy: { salesCount: "desc" },
      select: { id: true, nameRu: true, status: true, priceMin: true, media: { take: 1, orderBy: { sortOrder: "asc" }, select: { media: { select: mediaSelect } } } },
    });
    return rows.map((p) => ({ id: p.id, name: p.nameRu, status: p.status, price: p.priceMin, imageUrl: mediaUrl(p.media[0]?.media, 320) }));
  },
  { refresh: false },
);
