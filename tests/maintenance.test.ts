import { beforeEach, describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { db } from "@/server/db";
import { runCleanup, runReprice } from "@/server/cron";
import { updateSetting } from "@/server/settings";
import { applyImport, exportProducts, previewImport, PRODUCT_COLUMNS } from "@/server/admin/import-export";
import { createCatalog, createStaff, hasTestDb, resetDb } from "./helpers/fixtures";

const DAY = 86_400_000;

/** Изменить ячейки выгрузки по артикулу: { "DV-80": { "Цена": 6500 } } */
async function editSheet(buffer: Buffer, changes: Record<string, Record<string, string | number | null>>) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  const columns = new Map<string, number>();
  ws.getRow(1).eachCell((cell, n) => columns.set(String(cell.value), n));
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const sku = String(row.getCell(columns.get(PRODUCT_COLUMNS.sku)!).value);
    for (const [header, value] of Object.entries(changes[sku] ?? {})) row.getCell(columns.get(header)!).value = value;
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe.skipIf(!hasTestDb)("фоновые задачи и импорт", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("cleanup: удаляет просроченное и «осиротевшие» фото, не трогая нужное", async () => {
    const staff = await createStaff();
    const now = Date.now();
    await db.staffSession.createMany({
      data: [
        { id: "expired", staffUserId: staff.id, expiresAt: new Date(now - 1000) },
        { id: "active", staffUserId: staff.id, expiresAt: new Date(now + DAY) },
      ],
    });
    await db.rateLimit.createMany({
      data: [
        { key: "old", count: 3, resetAt: new Date(now - 1000) },
        { key: "fresh", count: 1, resetAt: new Date(now + 60_000) },
      ],
    });
    await db.cart.create({ data: { tokenHash: "stale", updatedAt: new Date(now - 90 * DAY) } });
    await db.cart.create({ data: { tokenHash: "fresh" } });

    const twoDaysAgo = new Date(now - 2 * DAY);
    const orphan = await db.media.create({ data: { externalUrl: "https://example.com/1.jpg", widths: [], createdAt: twoDaysAgo } });
    const brandLogo = await db.media.create({ data: { externalUrl: "https://example.com/2.jpg", widths: [], createdAt: twoDaysAgo } });
    const storeLogo = await db.media.create({ data: { externalUrl: "https://example.com/3.jpg", widths: [], createdAt: twoDaysAgo } });
    const justUploaded = await db.media.create({ data: { externalUrl: "https://example.com/4.jpg", widths: [] } });
    await db.brand.create({ data: { name: "Бренд", slug: "brand", logoId: brandLogo.id } });
    await updateSetting("general", { logoMediaId: storeLogo.id });

    const result = await runCleanup();
    expect(result.staffSessions).toBe(1);
    expect(result.orphanMedia).toBe(1);

    expect(await db.staffSession.findMany({ select: { id: true } })).toEqual([{ id: "active" }]);
    expect((await db.rateLimit.findMany({ select: { key: true } })).map((r) => r.key)).toEqual(["fresh"]);
    expect((await db.cart.findMany({ select: { tokenHash: true } })).map((c) => c.tokenHash)).toEqual(["fresh"]);
    const left = (await db.media.findMany({ select: { id: true } })).map((m) => m.id).sort();
    expect(left).toEqual([brandLogo.id, storeLogo.id, justUploaded.id].sort());
    expect(left).not.toContain(orphan.id);
  });

  it("reprice: закончилась акционная цена — цена в каталоге возвращается к обычной", async () => {
    const { product } = await createCatalog({ price: 6_000 });
    // акция закончилась час назад, а в каталоге всё ещё акционная цена
    await db.product.update({
      where: { id: product.id },
      data: { salePrice: 4_500, saleEndsAt: new Date(Date.now() - 3_600_000), priceMin: 4_500, priceMax: 4_500, discountPercent: 25 },
    });
    const { changed } = await runReprice();
    expect(changed).toBe(1);
    const after = await db.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(after.priceMin).toBe(6_000);
    expect(after.discountPercent).toBe(0);
    expect((await runReprice()).changed).toBe(0);
  });

  it("импорт выгрузки без правок не меняет варианты, правки ложатся только на нужный вариант", async () => {
    const staff = await createStaff("OWNER");
    const actor = { ...staff, ip: null };
    const { product } = await createCatalog({ price: 6_000 });
    await db.product.update({ where: { id: product.id }, data: { salePrice: 5_000 } });

    const original = await exportProducts(actor);
    expect(await previewImport(original)).toMatchObject({ rows: 2, updates: 2, creates: 0, errors: [] });
    await applyImport(original, actor);
    const unchanged = await db.productVariant.findMany({ where: { productId: product.id } });
    // цена, акция и себестоимость по-прежнему наследуются от товара
    for (const v of unchanged) expect([v.price, v.salePrice, v.costPrice]).toEqual([null, null, null]);

    const edited = await editSheet(original, {
      "DV-100": { [PRODUCT_COLUMNS.price]: 6_500, [PRODUCT_COLUMNS.stock]: 4 },
      "DV-80": { [PRODUCT_COLUMNS.salePrice]: "-" },
    });
    await applyImport(edited, actor);
    const v80 = await db.productVariant.findUniqueOrThrow({ where: { sku: "DV-80" } });
    const v100 = await db.productVariant.findUniqueOrThrow({ where: { sku: "DV-100" } });
    expect(v100.price).toBe(6_500);
    expect(v100.stock).toBe(4);
    // у товара есть акция, а у DV-80 её убрали — «без акции» именно у варианта
    expect(v80.salePrice).toBe(0);
    expect(v80.price).toBeNull();
    const movement = await db.stockMovement.findFirst({ where: { variantId: v100.id, reason: "IMPORT" } });
    expect(movement).not.toBeNull();
  });

  it("импорт: ошибки строк показываются до применения, новый товар создаётся черновиком", async () => {
    const staff = await createStaff("OWNER");
    const actor = { ...staff, ip: null };
    await createCatalog();
    const book = async (rows: (string | number | null)[][]) => {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Товары");
      ws.addRow([PRODUCT_COLUMNS.sku, PRODUCT_COLUMNS.name, PRODUCT_COLUMNS.category, PRODUCT_COLUMNS.price, PRODUCT_COLUMNS.stock]);
      for (const row of rows) ws.addRow(row);
      return Buffer.from(await wb.xlsx.writeBuffer());
    };
    const good = ["NEW-1", "Боди", "Для детей / Одежда", 3_990, 7];
    const buffer = await book([good, ["NEW-2", "Без категории", null, 1_000, 1], ["NEW-3", "Цена текстом", "Одежда", "дорого", 1]]);

    const plan = await previewImport(buffer);
    expect(plan.creates).toBe(1);
    expect(plan.errors.map((e) => e.row)).toEqual([3, 4]);
    await expect(applyImport(buffer, actor)).rejects.toThrow();
    expect(await db.product.count({ where: { nameRu: "Боди" } })).toBe(0);

    const fixed = await book([good]);
    expect(await applyImport(fixed, actor)).toEqual({ updated: 0, created: 1 });
    const created = await db.productVariant.findUniqueOrThrow({ where: { sku: "NEW-1" }, include: { product: true } });
    expect(created.product.status).toBe("DRAFT");
    expect(created.stock).toBe(7);
    expect(created.barcode).toMatch(/^21\d{11}$/);
  });
});
