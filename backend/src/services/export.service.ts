import ExcelJS from "exceljs";
import { prisma } from "../database/prisma.js";
import { HttpError } from "../utils/httpError.js";
import { pokemonService } from "./pokemon.service.js";
import type { ExploreCard } from "../types.js";

type ExportParams = {
  type: "full" | "set" | "card" | "missing";
  set?: string;
  id?: string;
};

export const exportService = {
  async buildWorkbook(userId: number, params: ExportParams): Promise<ExcelJS.Workbook> {
    if (params.type === "missing") {
      return buildMissingWorkbook(userId, params.set);
    }

    const where = {
      userId,
      ...(
      params.type === "set"
        ? { set: params.set }
        : params.type === "card"
          ? { cardId: params.id }
          : {}
      )
    };

    if (params.type === "set" && !params.set) {
      throw new HttpError(400, "Informe o parametro set para exportar por colecao.");
    }
    if (params.type === "card" && !params.id) {
      throw new HttpError(400, "Informe o parametro id para exportar uma carta.");
    }

    const rows = await prisma.collection.findMany({
      where,
      orderBy: { name: "asc" }
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Pokemon TCG Local";
    const sheet = workbook.addWorksheet("Colecao");

    sheet.columns = [
      { header: "idCarta", key: "cardNumber", width: 14 },
      { header: "nomeCarta", key: "name", width: 28 },
      { header: "Colecao", key: "set", width: 24 },
      { header: "Raridade", key: "rarity", width: 18 },
      { header: "Quantidade", key: "quantity", width: 14 },
      { header: "Preco", key: "price", width: 14 },
      { header: "Total", key: "total", width: 14 },
      { header: "Favorito", key: "favorite", width: 12 },
      { header: "Troca", key: "forTrade", width: 12 }
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF111827" }
    };

    rows.forEach((item) => {
      sheet.addRow({
        cardNumber: formatExportCardNumber(item.number, item.cardId),
        name: item.name,
        set: item.set,
        rarity: item.rarity ?? "Nao informada",
        quantity: item.quantity,
        price: item.price,
        total: item.price * item.quantity,
        favorite: item.favorite ? "Sim" : "Nao",
        forTrade: item.forTrade ? "Sim" : "Nao"
      });
    });

    sheet.getColumn("price").numFmt = '"R$" #,##0.00';
    sheet.getColumn("total").numFmt = '"R$" #,##0.00';
    sheet.columns.forEach((column) => {
      let max = String(column.header ?? "").length;
      column.eachCell?.({ includeEmpty: true }, (cell) => {
        max = Math.max(max, String(cell.value ?? "").length);
      });
      column.width = Math.min(Math.max(max + 2, Number(column.width ?? 12)), 42);
    });

    return workbook;
  }
};

async function buildMissingWorkbook(userId: number, selectedSet?: string): Promise<ExcelJS.Workbook> {
  const userCards = await prisma.collection.findMany({
    where: { userId },
    select: { cardId: true, set: true }
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Pokemon TCG Local";
  const sheet = workbook.addWorksheet("Cartas faltantes");

  sheet.columns = [
    { header: "idCarta", key: "id", width: 18 },
    { header: "Numero", key: "number", width: 14 },
    { header: "nomeCarta", key: "name", width: 32 },
    { header: "Colecao", key: "set", width: 28 },
    { header: "Raridade", key: "rarity", width: 18 }
  ];

  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF111827" }
  };

  if (!userCards.length) return workbook;

  const ownedBySet = new Map<string, Set<string>>();
  for (const item of userCards) {
    const key = normalizeSetName(item.set);
    const set = ownedBySet.get(key) ?? new Set<string>();
    set.add(item.cardId);
    ownedBySet.set(key, set);
  }

  const sets = await pokemonService.listSets();
  const setMap = new Map(sets.map((set) => [normalizeSetName(set.name), set]));

  const targetSetKeys = selectedSet
    ? [normalizeSetName(selectedSet)]
    : Array.from(ownedBySet.keys());

  const missingRows: ExploreCard[] = [];

  for (const setKey of targetSetKeys) {
    const apiSet = setMap.get(setKey);
    if (!apiSet) continue;

    const setCards = await loadAllSetCards(apiSet.id);
    const ownedIds = ownedBySet.get(setKey) ?? new Set<string>();
    for (const card of setCards) {
      if (!ownedIds.has(card.id)) {
        missingRows.push(card);
      }
    }
  }

  missingRows
    .sort((a, b) => a.set.localeCompare(b.set) || cardNumberValue(a.number) - cardNumberValue(b.number) || a.name.localeCompare(b.name))
    .forEach((card) => {
      sheet.addRow({
        id: card.id,
        number: card.number ?? formatExportCardNumber(null, card.id),
        name: card.name,
        set: card.set,
        rarity: card.rarity ?? "Nao informada"
      });
    });

  sheet.columns.forEach((column) => {
    let max = String(column.header ?? "").length;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      max = Math.max(max, String(cell.value ?? "").length);
    });
    column.width = Math.min(Math.max(max + 2, Number(column.width ?? 12)), 46);
  });

  return workbook;
}

async function loadAllSetCards(setId: string): Promise<ExploreCard[]> {
  const pageSize = 250;
  const firstPage = await pokemonService.listCards(1, pageSize, undefined, setId, "numberAsc");
  const totalPages = Math.max(1, Math.ceil(firstPage.totalCount / pageSize));
  if (totalPages === 1) return firstPage.cards;

  const pages = Array.from({ length: totalPages - 1 }, (_, index) => index + 2);
  const otherPages = await Promise.all(pages.map((page) => pokemonService.listCards(page, pageSize, undefined, setId, "numberAsc")));
  return [...firstPage.cards, ...otherPages.flatMap((entry) => entry.cards)];
}

function formatExportCardNumber(number: string | null, cardId: string): string {
  if (number?.trim()) return number.trim();
  return cardId.split("-").at(-1) ?? cardId;
}

function normalizeSetName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function cardNumberValue(number?: string): number {
  const parsed = Number(number?.match(/\d+/)?.[0] ?? Number.MAX_SAFE_INTEGER);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}
