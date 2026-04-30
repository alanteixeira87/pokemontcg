import { Router } from "express";
import { exportController } from "../controllers/export.controller.js";

export const exportRoutes = Router();

exportRoutes.get("/export", exportController.download);
