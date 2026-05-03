import ExcelJS from "exceljs";
import { collectionService } from "./collection.service.js";
import { pokemonService } from "./pokemon.service.js";

type ImportRow = {
  series: string;
  number: string;
  sequence: string;
  status: string;
  quantity: string;
  rowNumber?: number;
  reason?: string;
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

function readHeaderMap(sheet: ExcelJS.Worksheet, rowNumber: number): Map<string, number> {
  const header = sheet.getRow(rowNumber);
  const map = new Map<string, number>();

  header.eachCell((cell, columnNumber) => {
    map.set(normalizeHeader(cellText(cell.value)), columnNumber);
  });

  return map;
}

function findHeaderRow(sheet: ExcelJS.Worksheet): { headerMap: Map<string, number>; rowNumber: number } {
  for (let rowNumber = 1; rowNumber <= Math.min(sheet.rowCount, 30); rowNumber += 1) {
    const headerMap = readHeaderMap(sheet, rowNumber);
    const hasSeries = ["serie", "s rie", "set", "colecao", "colecao set", "expansao", "edicao"].some((key) => headerMap.has(key));
    const hasNumber = ["numero", "n mero", "n", "num", "card", "carta"].some((key) => headerMap.has(key));
    const hasStatus = ["status", "situacao", "possuo", "tenho"].some((key) => headerMap.has(key));
    const hasQuantity = ["qtde", "qtd", "quantidade", "quantity"].some((key) => headerMap.has(key));

    if (hasSeries && hasNumber && (hasStatus || hasQuantity)) {
      return { headerMap, rowNumber };
    }
  }

  return { headerMap: readHeaderMap(sheet, 1), rowNumber: 1 };
}

function readRow(sheet: ExcelJS.Worksheet, rowNumber: number, headerMap: Map<string, number>): ImportRow {
  const row = sheet.getRow(rowNumber);
  const value = (fallbackColumn: number, keys: string[], useFallback = true) => {
    const column = keys.map((key) => headerMap.get(key)).find(Boolean);
    if (!column && !useFallback) return "";
    return cellText(row.getCell(column ?? fallbackColumn).value);
  };

  return {
    rowNumber,
    series: value(1, ["serie", "s rie", "set", "colecao", "colecao set", "expansao", "edicao"]),
    number: value(2, ["numero", "n mero", "n", "num", "card", "carta"]),
    sequence: value(3, ["sequencia", "seq encia", "seq", "ordem", "codigo"], false),
    status: value(4, ["status", "situacao", "possuo", "tenho"]),
    quantity: value(5, ["qtde", "qtd", "quantidade", "quantity"])
  };
}

function normalizeCardNumber(value: string): string {
  const trimmed = value.trim();
  const beforeSlash = trimmed.split("/")[0]?.trim() ?? trimmed;
  return beforeSlash.replace(/^#/, "").replace(/^0+(\d)/, "$1");
}

function isOwnedStatus(value: string): boolean {
  const normalized = normalizeHeader(value);
  return ["ok", "sim", "s", "x", "tenho", "possuo", "owned", "yes", "y", "1"].includes(normalized);
}

function parseQuantity(value: string): number {
  const normalized = value.replace(",", ".").trim();
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
}

function isEmptyRow(row: ImportRow): boolean {
  return !row.series && !row.number && !row.sequence && !row.status && !row.quantity;
}

export const importService = {
  async importCollection(userId: number, buffer: Buffer): Promise<ImportResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const sheet = workbook.worksheets[0];

    if (!sheet) {
      return { imported: 0, skipped: 0, notFound: [] };
    }

    const { headerMap, rowNumber: headerRowNumber } = findHeaderRow(sheet);
    const result: ImportResult = { imported: 0, skipped: 0, notFound: [] };

    for (let rowNumber = headerRowNumber + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = readRow(sheet, rowNumber, headerMap);
      if (isEmptyRow(row)) continue;

      const hasCard = isOwnedStatus(row.status);
      const cardNumber = normalizeCardNumber(row.number);
      const quantity = parseQuantity(row.quantity);

      if (!hasCard || !row.series || !cardNumber) {
        if (hasCard && (!row.series || !cardNumber)) {
          result.notFound.push({
            ...row,
            reason: !row.series ? "Linha marcada como OK, mas sem serie/colecao." : "Linha marcada como OK, mas sem numero da carta."
          });
        }
        result.skipped += 1;
        continue;
      }

      const card = await pokemonService.findCardBySetAndNumber(row.series, cardNumber);

      if (!card) {
        result.notFound.push({
          ...row,
          number: cardNumber,
          reason: `Nao encontrei a carta numero "${cardNumber}" dentro da colecao oficial "${row.series}".`
        });
        continue;
      }

      await collectionService.add(userId, {
        cardId: card.id,
        name: card.name,
        image: card.image,
        set: card.set,
        quantity,
        price: card.marketPrice ?? 0,
        number: card.number
      });
      result.imported += quantity;
    }

    return result;
  }
};
