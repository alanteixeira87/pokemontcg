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
  const value = (fallbackColumn: number, ...keys: string[]) => {
    const column = keys.map((key) => headerMap.get(key)).find(Boolean);
    return cellText(row.getCell(column ?? fallbackColumn).value);
  };

  return {
    rowNumber,
    series: value(1, "serie", "s rie", "set", "colecao", "colecao set", "expansao", "edicao"),
    number: value(2, "numero", "n mero", "n", "num", "card", "carta"),
    sequence: value(3, "sequencia", "seq encia", "seq", "ordem", "codigo"),
    status: value(4, "status", "situacao", "possuo", "tenho"),
    quantity: value(5, "qtde", "qtd", "quantidade", "quantity")
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
      const hasCard = isOwnedStatus(row.status);
      const cardNumber = normalizeCardNumber(row.number);
      const quantity = parseQuantity(row.quantity);

      if (!hasCard || !row.series || !cardNumber) {
        if (hasCard && (!row.series || !cardNumber)) {
          result.notFound.push({
            ...row,
            reason: !row.series ? "Linha marcada como OK, mas sem serie/colecao." : "Linha marcada como OK, mas sem numero/sequencia."
          });
        }
        result.skipped += 1;
        continue;
      }

      const card = await pokemonService.findCardBySetAndNumber(row.series, cardNumber, row.sequence);

      if (!card) {
        result.notFound.push({
          ...row,
          number: cardNumber,
          reason: `Nao encontrei carta para serie "${row.series}", sequencia "${row.sequence}" e numero "${cardNumber}".`
        });
        continue;
      }

      await collectionService.add(userId, {
        cardId: card.id,
        name: card.name,
        image: card.image,
        set: card.set,
        quantity,
        price: card.marketPrice ?? 0
      });
      result.imported += quantity;
    }

    return result;
  }
};
