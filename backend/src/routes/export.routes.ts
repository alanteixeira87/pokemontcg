import { Router } from "express";
import { exportController } from "../controllers/export.controller.js";
import { requireAuth } from "../middlewares/authMiddleware.js";

export const exportRoutes = Router();

exportRoutes.use(requireAuth);
exportRoutes.get("/export", exportController.download);
