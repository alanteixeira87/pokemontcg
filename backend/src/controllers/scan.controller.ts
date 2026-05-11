import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/httpError.js";
import { scanService } from "../services/scan.service.js";

function hasValidImageSignature(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;

  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;
  const isWebp =
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50;

  return isJpeg || isPng || isWebp;
}

function sanitizeInput(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const next = value.trim().slice(0, 80);
  return next || undefined;
}

export const scanController = {
  async analyze(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        throw new HttpError(400, "Envie uma imagem no campo file.");
      }
      if (!hasValidImageSignature(req.file.buffer)) {
        throw new HttpError(400, "Formato de imagem invalido. Use JPG, PNG ou WEBP.");
      }

      const result = await scanService.analyze({
        imageBuffer: req.file.buffer,
        language: sanitizeInput(req.body.language),
        condition: sanitizeInput(req.body.condition),
        variantType: sanitizeInput(req.body.variantType)
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
};
