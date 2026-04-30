import { Router } from "express";
import { cardsController } from "../controllers/cards.controller.js";

export const cardsRoutes = Router();

cardsRoutes.get("/cards", cardsController.list);
cardsRoutes.get("/sets", cardsController.sets);
cardsRoutes.get("/collections", cardsController.sets);
cardsRoutes.get("/colecoes", cardsController.sets);
