"use server";

import { z } from "zod";
import { adminAction } from "@/server/admin/action";
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
