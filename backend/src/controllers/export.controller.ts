import type { Request, Response, NextFunction } from "express";
import { exportQuerySchema } from "../schemas/cards.schema.js";
import { exportService } from "../services/export.service.js";

export const exportController = {
  async download(req: Request, res: Response, next: NextFunction) {
    try {
      const query = exportQuerySchema.parse(req.query);
      const workbook = await exportService.buildWorkbook(query);
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
