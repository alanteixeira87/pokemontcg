import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { createRateLimit } from "../middlewares/rateLimit.js";
import { scanController } from "../controllers/scan.controller.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024
  },
  fileFilter: (_req, file, callback) => {
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
    callback(null, allowedMimeTypes.includes(file.mimetype));
  }
});

export const scanRoutes = Router();

scanRoutes.post(
  "/scan/analyze",
  requireAuth,
  createRateLimit({ windowMs: 60_000, max: 10 }),
  upload.single("file"),
  scanController.analyze
);
