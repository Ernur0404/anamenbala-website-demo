/** Полная переиндексация товаров (цены, наличие, поиск, фильтры): npm run reindex */
import "dotenv/config";
import { db } from "@/server/db";
import { reindexAllProducts } from "@/server/catalog/indexer";

reindexAllProducts()
  .then(() => console.log("Товары переиндексированы"))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
