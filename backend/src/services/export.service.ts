import ExcelJS from "exceljs";
import { prisma } from "../database/prisma.js";
import { HttpError } from "../utils/httpError.js";

type ExportParams = {
  type: "full" | "set" | "card";
  set?: string;
  id?: string;
};

export const exportService = {
  async buildWorkbook(userId: number, params: ExportParams): Promise<ExcelJS.Workbook> {
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

function formatExportCardNumber(number: string | null, cardId: string): string {
  if (number?.trim()) return number.trim();
  return cardId.split("-").at(-1) ?? cardId;
}
