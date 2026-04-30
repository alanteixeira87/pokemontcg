import ExcelJS from "exceljs";
import { collectionService } from "./collection.service.js";
import { pokemonService } from "./pokemon.service.js";

type ImportRow = {
  series: string;
  number: string;
  sequence: string;
  status: string;
};

type ImportResult = {
  imported: number;
  skipped: number;
  notFound: ImportRow[];
};

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "text" in value) return String(value.text ?? "").trim();
  if (typeof value === "object" && "result" in value) return String(value.result ?? "").trim();
  return String(value).trim();
}

function readHeaderMap(sheet: ExcelJS.Worksheet): Map<string, number> {
  const header = sheet.getRow(1);
  const map = new Map<string, number>();

  header.eachCell((cell, columnNumber) => {
    map.set(normalizeHeader(cellText(cell.value)), columnNumber);
  });

  return map;
}

function readRow(sheet: ExcelJS.Worksheet, rowNumber: number, headerMap: Map<string, number>): ImportRow {
  const row = sheet.getRow(rowNumber);
  const value = (key: string) => {
    const column = headerMap.get(key);
    return column ? cellText(row.getCell(column).value) : "";
  };

  return {
    series: value("serie"),
    number: value("numero"),
    sequence: value("sequencia"),
    status: value("status")
  };
}

export const importService = {
  async importCollection(userId: number, buffer: Buffer): Promise<ImportResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const sheet = workbook.worksheets[0];

    if (!sheet) {
      return { imported: 0, skipped: 0, notFound: [] };
    }

    const headerMap = readHeaderMap(sheet);
    const result: ImportResult = { imported: 0, skipped: 0, notFound: [] };

    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = readRow(sheet, rowNumber, headerMap);
      const hasCard = normalizeHeader(row.status) === "ok";
      const cardNumber = row.number || row.sequence;

      if (!hasCard || !row.series || !cardNumber) {
        result.skipped += 1;
        continue;
      }

      const card = await pokemonService.findCardBySetAndNumber(row.series, cardNumber);

      if (!card) {
        result.notFound.push(row);
        continue;
      }

      await collectionService.add(userId, {
        cardId: card.id,
        name: card.name,
        image: card.image,
        set: card.set,
        quantity: 1,
        price: card.marketPrice ?? 0
      });
      result.imported += 1;
    }

    return result;
  }
};
