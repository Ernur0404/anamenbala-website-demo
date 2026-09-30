import { refreshProductIndex } from "./catalog/indexer";
import { notifyLowStock } from "./notifications";
import type { StockChange } from "./stock";

/** После изменения остатков: пересчитать наличие товаров и предупредить о заканчивающихся размерах */
export async function afterStockChange(productIds: Iterable<string>, changes?: Iterable<StockChange>) {
  const ids = new Set(productIds);
  if (changes) for (const c of changes) ids.add(c.productId);
  await refreshProductIndex([...ids]);
  if (changes) await notifyLowStock(changes).catch((e) => console.error("[low-stock]", e));
}
