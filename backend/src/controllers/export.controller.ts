import type { Request, Response, NextFunction } from "express";
import { exportQuerySchema } from "../schemas/cards.schema.js";
import { exportService } from "../services/export.service.js";
import { getAuthenticatedUserId } from "../middlewares/authMiddleware.js";
import { HttpError } from "../utils/httpError.js";

export const exportController = {
  async download(req: Request, res: Response, next: NextFunction) {
    try {
      const query = exportQuerySchema.parse(req.query);
      if (query.type === "repeatedPdf") {
        if (!query.set) {
          throw new HttpError(400, "Informe o set para exportar o PDF de cartas repetidas.");
        }
        const pdf = await exportService.buildRepeatedCardsPdf(getAuthenticatedUserId(req), query.set);
        const filename = query.set
          ? `pokemon-repetidas-${query.set.replace(/\s+/g, "-").toLowerCase()}.pdf`
          : "pokemon-repetidas.pdf";
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.send(pdf);
        return;
      }

      const workbook = await exportService.buildWorkbook(getAuthenticatedUserId(req), query);
      const filename = `pokemon-colecao-${query.type}.xlsx`;

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      next(error);
    }
  }
};
