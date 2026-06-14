import ExcelJS from "exceljs";
import { createHash } from "node:crypto";
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

type PreparedImportRow = {
  row: ImportRow;
  cardNumber: string;
  quantity: number;
};

type CollectionImportInput = Parameters<typeof collectionService.addMany>[1][number];
type CollectionRestoreInput = Parameters<typeof collectionService.restoreMany>[1][number];
type FullExportRow = {
  rowNumber: number;
  cardNumber: string;
  name: string;
  set: string;
  rarity: string;
  quantity: number;
  price: number;
  favorite: boolean;
  forTrade: boolean;
};

const fallbackCardImage = "https://images.pokemontcg.io/base1/4.png";

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeLookup(value: string): string {
  return normalizeHeader(value).replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
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

function parsePrice(value: string): number {
  const normalized = value
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function parseBoolean(value: string): boolean {
  return ["sim", "s", "yes", "y", "true", "1"].includes(normalizeHeader(value));
}

function isFullExport(headerMap: Map<string, number>): boolean {
  return (
    ["nome", "nomecarta"].some((key) => headerMap.has(key)) &&
    ["set", "colecao"].some((key) => headerMap.has(key)) &&
    ["quantidade", "quantity", "qtd", "qtde"].some((key) => headerMap.has(key)) &&
    ["preco", "price"].some((key) => headerMap.has(key))
  );
}

function restoredCardId(set: string, name: string, rowNumber: number): string {
  const digest = createHash("sha256").update(`${set}\u0000${name}\u0000${rowNumber}`).digest("hex").slice(0, 40);
  return `restored-${digest}`;
}

async function loadOfficialCardsBySet(setNames: string[]): Promise<Map<string, CollectionImportInput[]>> {
  const result = new Map<string, CollectionImportInput[]>();
  let sets;

  try {
    sets = await pokemonService.listSets();
  } catch {
    return result;
  }

  const setsByName = new Map(sets.map((set) => [normalizeLookup(set.name), set]));
  const uniqueSetNames = Array.from(new Set(setNames));

  const concurrency = 3;
  for (let index = 0; index < uniqueSetNames.length; index += concurrency) {
    const chunk = uniqueSetNames.slice(index, index + concurrency);
    await Promise.all(
      chunk.map(async (setName) => {
      const officialSet = setsByName.get(normalizeLookup(setName));
      if (!officialSet) return;

      try {
        const pageSize = 250;
        const firstPage = await pokemonService.listCards(1, pageSize, undefined, officialSet.id, "numberAsc");
        const totalPages = Math.max(1, Math.ceil(firstPage.totalCount / pageSize));
        const otherPages =
          totalPages > 1
            ? await Promise.all(
                Array.from({ length: totalPages - 1 }, (_, index) =>
                  pokemonService.listCards(index + 2, pageSize, undefined, officialSet.id, "numberAsc")
                )
              )
            : [];
        result.set(
          normalizeLookup(setName),
          [...firstPage.cards, ...otherPages.flatMap((page) => page.cards)].map((card) => ({
            cardId: card.id,
            name: card.name,
            image: card.image,
            set: card.set,
            quantity: 1,
            price: card.marketPrice ?? 0,
            number: card.number,
            rarity: card.rarity
          }))
        );
      } catch {
        // Keep rows importable with restored IDs if an external card source is unavailable.
      }
      })
    );
  }

  return result;
}

function matchOfficialCard(
  row: FullExportRow,
  officialCards: CollectionImportInput[],
  usedCardIds: Set<string>
): CollectionImportInput | null {
  const normalizedName = normalizeLookup(row.name);
  const normalizedNumber = normalizeCardNumber(row.cardNumber);
  const candidates = officialCards.filter((card) => !usedCardIds.has(card.cardId) && normalizeLookup(card.name) === normalizedName);
  const matched =
    (normalizedNumber
      ? candidates.find((card) => normalizeCardNumber(card.number ?? "") === normalizedNumber)
      : undefined) ?? candidates[0];

  if (matched) usedCardIds.add(matched.cardId);
  return matched ?? null;
}

async function restoreFullExport(
  userId: number,
  sheet: ExcelJS.Worksheet,
  headerMap: Map<string, number>,
  headerRowNumber: number
): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, skipped: 0, notFound: [] };
  const inputs: CollectionRestoreInput[] = [];
  const column = (keys: string[]) => keys.map((key) => headerMap.get(key)).find(Boolean);
  const nameColumn = column(["nome", "nomecarta"]);
  const setColumn = column(["set", "colecao"]);
  const quantityColumn = column(["quantidade", "quantity", "qtd", "qtde"]);
  const priceColumn = column(["preco", "price"]);
  const favoriteColumn = column(["favorito", "favorite"]);
  const tradeColumn = column(["troca", "fortrade", "para troca"]);
  const cardNumberColumn = column(["idcarta", "numero", "number"]);
  const rarityColumn = column(["raridade", "rarity"]);

  if (!nameColumn || !setColumn || !quantityColumn || !priceColumn) {
    return result;
  }

  const rows: FullExportRow[] = [];

  for (let rowNumber = headerRowNumber + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const name = cellText(row.getCell(nameColumn).value);
    const set = cellText(row.getCell(setColumn).value);
    if (!name && !set) continue;

    if (!name || !set) {
      result.skipped += 1;
      result.notFound.push({
        rowNumber,
        series: set,
        number: "",
        sequence: "",
        status: "",
        quantity: quantityColumn ? cellText(row.getCell(quantityColumn).value) : "",
        reason: !name ? "Linha do export sem nome da carta." : "Linha do export sem colecao."
      });
      continue;
    }

    rows.push({
      rowNumber,
      cardNumber: cardNumberColumn ? cellText(row.getCell(cardNumberColumn).value) : "",
      name,
      set,
      rarity: rarityColumn ? cellText(row.getCell(rarityColumn).value) : "",
      quantity: parseQuantity(cellText(row.getCell(quantityColumn).value)),
      price: parsePrice(cellText(row.getCell(priceColumn).value)),
      favorite: favoriteColumn ? parseBoolean(cellText(row.getCell(favoriteColumn).value)) : false,
      forTrade: tradeColumn ? parseBoolean(cellText(row.getCell(tradeColumn).value)) : false
    });
  }

  const officialCardsBySet = await loadOfficialCardsBySet(rows.map((row) => row.set));
  const usedCardIds = new Set<string>();

  rows.forEach((row) => {
    const officialCard = matchOfficialCard(row, officialCardsBySet.get(normalizeLookup(row.set)) ?? [], usedCardIds);
    inputs.push({
      cardId: officialCard?.cardId ?? restoredCardId(row.set, row.name, row.rowNumber),
      name: officialCard?.name ?? row.name,
      image: officialCard?.image || fallbackCardImage,
      set: officialCard?.set ?? row.set,
      number: officialCard?.number || row.cardNumber || undefined,
      rarity: officialCard?.rarity || row.rarity || undefined,
      quantity: row.quantity,
      price: row.price,
      favorite: row.favorite,
      forTrade: row.forTrade
    });
  });

  result.imported = await collectionService.restoreMany(userId, inputs);
  return result;
}

function isEmptyRow(row: ImportRow): boolean {
  return !row.series && !row.number && !row.sequence && !row.status && !row.quantity;
}

function groupRowsBySeries(rows: PreparedImportRow[]): Map<string, PreparedImportRow[]> {
  const grouped = new Map<string, PreparedImportRow[]>();
  rows.forEach((row) => {
    const key = row.row.series.trim().toUpperCase();
    const current = grouped.get(key) ?? [];
    current.push(row);
    grouped.set(key, current);
  });
  return grouped;
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
    if (isFullExport(headerMap)) {
      return restoreFullExport(userId, sheet, headerMap, headerRowNumber);
    }

    const result: ImportResult = { imported: 0, skipped: 0, notFound: [] };
    const preparedRows: PreparedImportRow[] = [];
    const collectionInputs: CollectionImportInput[] = [];

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

      preparedRows.push({ row, cardNumber, quantity });
    }

    const groupedRows = groupRowsBySeries(preparedRows);

    for (const [series, rows] of groupedRows.entries()) {
      const cards = await pokemonService.findCardsBySetAndNumbers(
        series,
        rows.map((row) => row.cardNumber)
      );

      for (const { row, cardNumber, quantity } of rows) {
        const card = cards.get(cardNumber);

        if (!card) {
          result.notFound.push({
            ...row,
            number: cardNumber,
            reason: `Nao encontrei a carta numero "${cardNumber}" dentro da colecao oficial "${row.series}".`
          });
          continue;
        }

        collectionInputs.push({
          cardId: card.id,
          name: card.name,
          image: card.image,
          set: card.set,
          quantity,
          price: card.marketPrice ?? 0,
          number: card.number,
          rarity: card.rarity
        });
        result.imported += quantity;
      }
    }

    await collectionService.addMany(userId, collectionInputs);

    return result;
  }
};
