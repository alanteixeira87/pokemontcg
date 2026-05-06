import { Router } from "express";
import { adminController } from "../controllers/admin.controller.js";
import { profileController } from "../controllers/profile.controller.js";
import { requireAuth, requireMasterAdmin } from "../middlewares/authMiddleware.js";

export const profileRoutes = Router();

profileRoutes.use(requireAuth);
profileRoutes.get("/profile", profileController.get);
profileRoutes.patch("/profile", profileController.update);
profileRoutes.get("/admin/overview", requireMasterAdmin, adminController.overview);
profileRoutes.get("/admin/users", requireMasterAdmin, adminController.users);
