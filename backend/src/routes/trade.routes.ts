import { Router } from "express";
import { tradeController } from "../controllers/trade.controller.js";
import { requireAuth } from "../middlewares/authMiddleware.js";

export const tradeRoutes = Router();

tradeRoutes.use(requireAuth);
tradeRoutes.get("/trade/users", tradeController.searchUsers);
tradeRoutes.get("/trade/users/:userId/cards", tradeController.userCards);
tradeRoutes.get("/trade/my-cards", tradeController.myCards);
tradeRoutes.get("/trade/proposals", tradeController.list);
tradeRoutes.post("/trade/proposals", tradeController.create);
tradeRoutes.patch("/trade/proposals/:id/status", tradeController.updateStatus);
tradeRoutes.get("/trade/proposals/:id/messages", tradeController.listMessages);
tradeRoutes.post("/trade/proposals/:id/messages", tradeController.sendMessage);
tradeRoutes.put("/trade/collection/:collectionId/variants", tradeController.updateVariants);
