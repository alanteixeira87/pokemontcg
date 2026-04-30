import type { Request, Response, NextFunction } from "express";
import { HttpError } from "../utils/httpError.js";
import { importService } from "../services/import.service.js";

export const importController = {
  async upload(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        throw new HttpError(400, "Envie uma planilha Excel no campo file.");
      }

      const result = await importService.importCollection(req.file.buffer);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
};
