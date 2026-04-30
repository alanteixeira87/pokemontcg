import { Router } from "express";
import multer from "multer";
import { importController } from "../controllers/import.controller.js";

export const importRoutes = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024
  },
  fileFilter: (_req, file, callback) => {
    const isExcel =
      file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.originalname.toLowerCase().endsWith(".xlsx");

    callback(null, isExcel);
  }
});

importRoutes.post("/import/collection", upload.single("file"), importController.upload);
