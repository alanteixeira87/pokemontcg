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
  totalRows: number;
  validRows: number;
  ignoredRows: number;
  errors: ImportRow[];
  headerRow?: number;
};

const importColumns = {
  series: ["serie", "s rie", "set", "colecao", "colecao set", "expansao", "edicao"],
  number: ["numero", "n mero", "n", "num", "card", "carta"],
  sequence: ["sequencia", "seq encia", "seq", "ordem", "codigo"],
  status: ["status", "situacao", "possuo", "tenho"],
  quantity: ["qtde", "qtd", "quantidade", "quantity"]
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
  if (typeof value === "object" && "richText" in value) {
    return value.richText.map((part) => part.text).join("").trim();
  }
  return String(value).trim();
}

function readHeaderMap(sheet: ExcelJS.Worksheet): Map<string, number> {
  const headerRow = findHeaderRow(sheet);
  if (!headerRow) return new Map();
  const header = sheet.getRow(headerRow);
  const map = new Map<string, number>();

  header.eachCell((cell, columnNumber) => {
    map.set(normalizeHeader(cellText(cell.value)), columnNumber);
  });

  return map;
}

function headerScore(values: string[]): number {
  const normalized = values.map(normalizeHeader).filter(Boolean);
  return Object.values(importColumns).reduce((score, aliases) => {
    return aliases.some((alias) => normalized.includes(normalizeHeader(alias))) ? score + 1 : score;
  }, 0);
}

function findHeaderRow(sheet: ExcelJS.Worksheet): number | null {
  let bestRow: number | null = null;
  let bestScore = 0;

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const values: string[] = [];
    row.eachCell({ includeEmpty: false }, (cell) => {
      values.push(cellText(cell.value));
    });

    const score = headerScore(values);
    if (score > bestScore) {
      bestScore = score;
      bestRow = rowNumber;
    }
  });

  return bestScore >= 3 ? bestRow : null;
}

function readRow(sheet: ExcelJS.Worksheet, rowNumber: number, headerMap: Map<string, number>): ImportRow {
  const row = sheet.getRow(rowNumber);
  const value = (fallbackColumn: number, ...keys: string[]) => {
    const column = keys.map((key) => headerMap.get(key)).find(Boolean);
    return cellText(row.getCell(column ?? fallbackColumn).value);
  };

  return {
    rowNumber,
    series: value(1, ...importColumns.series),
    number: value(2, ...importColumns.number),
    sequence: value(3, ...importColumns.sequence),
    status: value(4, ...importColumns.status),
    quantity: value(5, ...importColumns.quantity)
  };
}

function hasImportData(row: ImportRow): boolean {
  return Boolean(row.series || row.number || row.sequence || row.status || row.quantity);
}

function importRowNumbers(sheet: ExcelJS.Worksheet, headerMap: Map<string, number>, headerRow: number): number[] {
  const rows: number[] = [];

  sheet.eachRow({ includeEmpty: false }, (_row, rowNumber) => {
    if (rowNumber <= headerRow) return;
    if (hasImportData(readRow(sheet, rowNumber, headerMap))) {
      rows.push(rowNumber);
    }
  });

  return rows;
}

function normalizeCardNumber(value: string): string {
  const trimmed = value.trim();
  const beforeSlash = trimmed.split("/")[0]?.trim() ?? trimmed;
  return beforeSlash.replace(/^#/, "").replace(/^0+(\d)/, "$1");
}

function normalizeStatus(value: string): string {
  const normalized = normalizeHeader(value);
  return normalized || "pendente";
}

function isOwnedStatus(value: string): boolean {
  const normalized = normalizeHeader(value);
  return ["ok", "sim", "s", "x", "tenho", "possuo", "owned", "yes", "y", "1"].includes(normalized);
}

function parseQuantity(value: string): number {
  const normalized = value.replace(",", ".").trim();
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 1) return 0;
  return Math.floor(parsed);
}

function buildEmptyResult(): ImportResult {
  return { imported: 0, skipped: 0, notFound: [], totalRows: 0, validRows: 0, ignoredRows: 0, errors: [] };
}

export const importService = {
  async importCollection(userId: number, buffer: Buffer): Promise<ImportResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const sheet = workbook.worksheets[0];

    if (!sheet) {
      return buildEmptyResult();
    }

    const headerRow = findHeaderRow(sheet);
    if (!headerRow) {
      return {
        ...buildEmptyResult(),
        ignoredRows: sheet.actualRowCount,
        errors: [{ series: "", number: "", sequence: "", status: "", quantity: "", reason: "Header nao encontrado. Esperado: serie, numero, sequencia, status e qtde." }]
      };
    }

    const headerMap = readHeaderMap(sheet);
    const result: ImportResult = { imported: 0, skipped: 0, notFound: [], totalRows: 0, validRows: 0, ignoredRows: 0, errors: [], headerRow };

    const rowsToImport = importRowNumbers(sheet, headerMap, headerRow);
    result.totalRows = rowsToImport.length;

    for (const rowNumber of rowsToImport) {
      try {
        const row = readRow(sheet, rowNumber, headerMap);
        const hasCard = isOwnedStatus(row.status);
        const cardNumber = normalizeCardNumber(row.number);
        const quantity = parseQuantity(row.quantity);
        const normalizedRow = {
          ...row,
          series: row.series.trim(),
          number: cardNumber,
          sequence: row.sequence.trim(),
          status: normalizeStatus(row.status),
          quantity: String(quantity)
        };

        if (!normalizedRow.series || !cardNumber) {
          result.ignoredRows += 1;
          result.skipped += 1;
          continue;
        }

        if (!hasCard) {
          result.ignoredRows += 1;
          result.skipped += 1;
          continue;
        }

        const importQuantity = quantity > 0 ? quantity : 1;
        result.validRows += 1;

        const card = await pokemonService.findCardBySetAndNumber(normalizedRow.series, cardNumber, normalizedRow.sequence);

        if (!card) {
          result.notFound.push({
            ...normalizedRow,
            reason: `Nao encontrei carta para serie "${normalizedRow.series}", sequencia "${normalizedRow.sequence}" e numero "${cardNumber}".`
          });
          result.errors.push(result.notFound[result.notFound.length - 1]);
          continue;
        }

        await collectionService.add(userId, {
          cardId: card.id,
          name: card.name,
          image: card.image,
          set: card.set,
          quantity: importQuantity,
          price: card.marketPrice ?? 0,
          number: card.number
        });
        result.imported += importQuantity;
      } catch (error) {
        const failed = readRow(sheet, rowNumber, headerMap);
        const rowError = { ...failed, reason: error instanceof Error ? error.message : "Erro inesperado ao processar linha." };
        result.errors.push(rowError);
        result.ignoredRows += 1;
      }
    }

    return result;
  }
};
