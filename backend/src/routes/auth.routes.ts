import { Router } from "express";
import { authController } from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/authMiddleware.js";

export const authRoutes = Router();

authRoutes.post("/auth/register", authController.register);
authRoutes.post("/auth/login", authController.login);
authRoutes.get("/auth/me", requireAuth, authController.me);
