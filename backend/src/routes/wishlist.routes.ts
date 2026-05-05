import { Router } from "express";
import { wishlistController } from "../controllers/wishlist.controller.js";
import { requireAuth } from "../middlewares/authMiddleware.js";

export const wishlistRoutes = Router();

wishlistRoutes.use(requireAuth);
wishlistRoutes.get("/wishlist", wishlistController.list);
wishlistRoutes.post("/wishlist", wishlistController.add);
wishlistRoutes.delete("/wishlist/:cardId", wishlistController.remove);
wishlistRoutes.get("/wishlist/notifications", wishlistController.notifications);
