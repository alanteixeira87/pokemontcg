import { Router } from "express";
import { collectionController } from "../controllers/collection.controller.js";
import { requireAuth } from "../middlewares/authMiddleware.js";

export const collectionRoutes = Router();

collectionRoutes.use(requireAuth);
collectionRoutes.get("/collection", collectionController.list);
collectionRoutes.post("/collection", collectionController.add);
collectionRoutes.patch("/collection/:id", collectionController.update);
collectionRoutes.delete("/collection/:id", collectionController.remove);
collectionRoutes.get("/trades", collectionController.trades);
collectionRoutes.get("/dashboard", collectionController.dashboard);
