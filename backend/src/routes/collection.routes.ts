import { Router } from "express";
import { collectionController } from "../controllers/collection.controller.js";
import { requireAuth } from "../middlewares/authMiddleware.js";

export const collectionRoutes = Router();

collectionRoutes.use(requireAuth);
collectionRoutes.get("/collection", collectionController.list);
collectionRoutes.get("/collection/missing", collectionController.missingBySet);
collectionRoutes.post("/collection", collectionController.add);
collectionRoutes.post("/collection/reprice", collectionController.refreshPrices);
collectionRoutes.delete("/collection", collectionController.clear);
collectionRoutes.patch("/collection/:id", collectionController.update);
collectionRoutes.delete("/collection/:id", collectionController.remove);
collectionRoutes.get("/wanted", collectionController.wanted);
collectionRoutes.post("/wanted", collectionController.markWanted);
collectionRoutes.delete("/wanted/:cardId", collectionController.unmarkWanted);
collectionRoutes.get("/trades", collectionController.trades);
collectionRoutes.get("/dashboard", collectionController.dashboard);
