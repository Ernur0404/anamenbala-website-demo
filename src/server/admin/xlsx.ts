import ExcelJS from "exceljs";

export type SheetColumn<T> = { header: string; width?: number; value: (row: T) => string | number | Date | null | undefined; numFmt?: string };

/** Книга Excel с одним листом: жирная шапка, закреплённая первая строка, автофильтр */
export async function buildWorkbook<T>(sheetName: string, columns: SheetColumn<T>[], rows: T[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Ана мен бала";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(sheetName.slice(0, 31), { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = columns.map((c, i) => ({ header: c.header, key: `c${i}`, width: c.width ?? 18, style: c.numFmt ? { numFmt: c.numFmt } : undefined }));
  for (const row of rows) {
    sheet.addRow(Object.fromEntries(columns.map((c, i) => [`c${i}`, c.value(row) ?? ""])));
  }
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FF2F3430" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE4EDE7" } };
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export function xlsxResponse(buffer: Buffer, filename: string) {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
