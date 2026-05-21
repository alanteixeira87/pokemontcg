import axios from "axios";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { prisma } from "../database/prisma.js";
import { HttpError } from "../utils/httpError.js";
import { pokemonService } from "./pokemon.service.js";
import type { ExploreCard } from "../types.js";

type ExportParams = {
  type: "full" | "set" | "card" | "missing" | "repeatedPdf";
  set?: string;
  id?: string;
};

type RepeatedCardRow = {
  id: number;
  name: string;
  set: string;
  number: string | null;
  cardId: string;
  quantity: number;
  image: string;
};

type SetCoverMap = Map<string, string>;
type ImageBufferMap = Map<string, Buffer | null>;

const PDF_IMAGE_TIMEOUT_MS = 3500;
const PDF_PRELOAD_BUDGET_MS = 20000;
const PDF_MAX_IMAGE_DOWNLOADS = 120;

export const exportService = {
  async buildWorkbook(userId: number, params: ExportParams): Promise<ExcelJS.Workbook> {
    if (params.type === "repeatedPdf") {
      throw new HttpError(400, "Use o endpoint PDF para exportar cartas repetidas.");
    }

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
  },

  async buildRepeatedCardsPdf(userId: number, selectedSet?: string): Promise<Buffer> {
    const repeatedCards = await prisma.collection.findMany({
      where: {
        userId,
        set: selectedSet || undefined,
        quantity: { gt: 1 }
      },
      select: {
        id: true,
        name: true,
        set: true,
        number: true,
        cardId: true,
        quantity: true,
        image: true
      },
      orderBy: [{ set: "asc" }, { number: "asc" }, { name: "asc" }]
    });

    if (!repeatedCards.length) {
      throw new HttpError(404, "Nenhuma carta repetida encontrada para exportacao em PDF.");
    }

    const grouped = repeatedCards.reduce<Map<string, RepeatedCardRow[]>>((acc, card) => {
      const list = acc.get(card.set) ?? [];
      list.push(card);
      acc.set(card.set, list);
      return acc;
    }, new Map());

    const setCovers = await loadSetCoverMap();
    const fallbackCoverBySet = new Map<string, string>();
    const imageUrls = new Set<string>();

    for (const [setName, cards] of grouped.entries()) {
      const normalizedSetName = normalizeSetName(setName);
      const coverImageUrl = setCovers.get(normalizedSetName) ?? upscaleCardImage(cards[0]?.image ?? null);
      if (coverImageUrl) {
        fallbackCoverBySet.set(setName, coverImageUrl);
        imageUrls.add(coverImageUrl);
      }
      cards.forEach((card) => {
        if (card.image) imageUrls.add(upscaleCardImage(card.image));
      });
    }

    const prioritizedImageUrls = prioritizeImageUrls(Array.from(imageUrls));
    const imageBuffers = await preloadImageBuffers(prioritizedImageUrls, 12, PDF_PRELOAD_BUDGET_MS);
    const doc = new PDFDocument({ size: "A4", margin: 20 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    const result = new Promise<Buffer>((resolve, reject) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });

    let firstSet = true;
    for (const [setName, cards] of grouped.entries()) {
      if (!firstSet) {
        doc.addPage();
      }
      firstSet = false;

      const coverImageUrl = fallbackCoverBySet.get(setName) ?? null;
      renderSetCover(doc, setName, coverImageUrl, imageBuffers);
      renderSetGridPages(doc, setName, cards, imageBuffers);
    }

    doc.end();
    return result;
  }
};

function renderSetCover(doc: PDFKit.PDFDocument, setName: string, coverImageUrl: string | null, imageBuffers: ImageBufferMap) {
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const margin = 30;
  const contentWidth = pageWidth - margin * 2;
  const contentHeight = pageHeight - margin * 2;

  doc.rect(margin, margin, contentWidth, contentHeight).fill("#0f172a");

  if (coverImageUrl) {
    const image = imageBuffers.get(coverImageUrl) ?? null;
    if (image) {
      const imageWidth = contentWidth * 0.6;
      const imageHeight = contentHeight * 0.62;
      const x = (pageWidth - imageWidth) / 2;
      const y = margin + 46;
      doc.image(image, x, y, {
        fit: [imageWidth, imageHeight],
        align: "center",
        valign: "center"
      });
    }
  }

  doc.fillColor("#e2e8f0").fontSize(14).text("Catalogo de Cartas Repetidas", margin, pageHeight - 150, {
    width: contentWidth,
    align: "center"
  });
  doc.fillColor("#ffffff").fontSize(28).text(setName, margin, pageHeight - 120, {
    width: contentWidth,
    align: "center"
  });
  doc.fillColor("#cbd5e1").fontSize(11).text("Formato A4 - 5 colunas x 10 linhas", margin, pageHeight - 82, {
    width: contentWidth,
    align: "center"
  });
}

function renderSetGridPages(doc: PDFKit.PDFDocument, setName: string, cards: RepeatedCardRow[], imageBuffers: ImageBufferMap) {
  const cols = 5;
  const rows = 10;
  const perPage = cols * rows;
  const margin = 18;
  const gapX = 8;
  const gapY = 6;

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const titleHeight = 28;
  const usableWidth = pageWidth - margin * 2;
  const usableHeight = pageHeight - margin * 2 - titleHeight;
  const cellWidth = (usableWidth - gapX * (cols - 1)) / cols;
  const cellHeight = (usableHeight - gapY * (rows - 1)) / rows;

  for (let offset = 0; offset < cards.length; offset += perPage) {
    doc.addPage();
    const pageCards = cards.slice(offset, offset + perPage);
    const pageNumber = Math.floor(offset / perPage) + 1;
    const totalPages = Math.ceil(cards.length / perPage);

    doc.fillColor("#0f172a").fontSize(12).text(`${setName} - Repetidas`, margin, margin - 2);
    doc.fillColor("#64748b").fontSize(9).text(`Pagina ${pageNumber}/${totalPages}`, pageWidth - margin - 100, margin, {
      width: 100,
      align: "right"
    });

    for (const [index, card] of pageCards.entries()) {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = margin + col * (cellWidth + gapX);
      const y = margin + titleHeight + row * (cellHeight + gapY);
      drawCardCell(doc, card, x, y, cellWidth, cellHeight, imageBuffers);
    }
  }
}

function drawCardCell(doc: PDFKit.PDFDocument, card: RepeatedCardRow, x: number, y: number, width: number, height: number, imageBuffers: ImageBufferMap) {
  doc.roundedRect(x, y, width, height, 4).fillAndStroke("#ffffff", "#cbd5e1");

  const imageWidth = Math.min(34, Math.max(22, width * 0.28));
  const imageHeight = height - 10;
  const imageX = x + 4;
  const imageY = y + 5;

  if (card.image) {
    const buffer = imageBuffers.get(upscaleCardImage(card.image)) ?? null;
    if (buffer) {
      try {
        doc.image(buffer, imageX, imageY, {
          fit: [imageWidth, imageHeight],
          align: "center",
          valign: "center"
        });
      } catch {
        // ignore invalid image buffers and keep textual data visible
      }
    }
  }

  const textX = imageX + imageWidth + 4;
  const textWidth = width - (textX - x) - 4;
  doc.fillColor("#334155").fontSize(6.6).text(card.set, textX, y + 6, { width: textWidth, lineBreak: false });
  doc.fillColor("#0f172a").fontSize(8.6).text(`#${formatExportCardNumber(card.number, card.cardId)}`, textX, y + 20, { width: textWidth, lineBreak: false });
  doc.fillColor("#0f172a").fontSize(8.6).text(`Qtd: ${card.quantity}`, textX, y + 34, { width: textWidth, lineBreak: false });
}

const imageCache = new Map<string, Promise<Buffer | null>>();

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  const cached = imageCache.get(url);
  if (cached) return cached;

  const task = axios
    .get<ArrayBuffer>(url, { responseType: "arraybuffer", timeout: PDF_IMAGE_TIMEOUT_MS })
    .then((response) => Buffer.from(response.data))
    .catch(() => null);

  imageCache.set(url, task);
  return task;
}

async function preloadImageBuffers(urls: string[], concurrency = 10, budgetMs = PDF_PRELOAD_BUDGET_MS): Promise<ImageBufferMap> {
  const uniqueUrls = Array.from(new Set(urls.filter(Boolean))).slice(0, PDF_MAX_IMAGE_DOWNLOADS);
  const result: ImageBufferMap = new Map();
  if (!uniqueUrls.length) return result;
  const deadline = Date.now() + budgetMs;

  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, uniqueUrls.length) }, async () => {
    while (index < uniqueUrls.length && Date.now() < deadline) {
      const currentIndex = index;
      index += 1;
      const url = uniqueUrls[currentIndex];
      if (!url) continue;
      const buffer = await fetchImageBuffer(url);
      result.set(url, buffer);
    }
  });

  await Promise.all(workers);
  return result;
}

function prioritizeImageUrls(urls: string[]): string[] {
  const unique = Array.from(new Set(urls.filter(Boolean)));
  const coverLike = unique.filter((url) => !url.includes("/cards/"));
  const cardLike = unique.filter((url) => !coverLike.includes(url));
  return [...coverLike, ...cardLike];
}

async function loadSetCoverMap(): Promise<SetCoverMap> {
  const sets = await pokemonService.listSets();
  return sets.reduce<SetCoverMap>((acc, set) => {
    const cover = set.logo || set.symbol;
    if (cover) acc.set(normalizeSetName(set.name), cover);
    return acc;
  }, new Map());
}

function upscaleCardImage(url: string | null): string {
  if (!url) return "";
  if (url.includes("/small/")) return url.replace("/small/", "/large/");
  if (url.includes("_small.")) return url.replace("_small.", "_large.");
  return url;
}

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
