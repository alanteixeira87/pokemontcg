import type { Request, Response, NextFunction } from "express";
import { cardsQuerySchema } from "../schemas/cards.schema.js";
import { pokemonService } from "../services/pokemon.service.js";

export const cardsController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const query = cardsQuerySchema.parse(req.query);
      const result = await pokemonService.listCards(query.page, query.pageSize, query.search, query.set);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  async sets(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await pokemonService.listSets();
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
};
