import { Router } from "express";
import multer from "multer";
import { importController } from "../controllers/import.controller.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { HttpError } from "../utils/httpError.js";

export const importRoutes = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024
  },
  fileFilter: (_req, file, callback) => {
    const isExcel =
      file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.originalname.toLowerCase().endsWith(".xlsx");

    if (!isExcel) {
      callback(new HttpError(400, "Envie uma planilha no formato .xlsx."));
      return;
    }

    callback(null, true);
  }
});

importRoutes.post("/import/collection", requireAuth, upload.single("file"), importController.upload);
