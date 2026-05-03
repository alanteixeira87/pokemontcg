import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { addCardSchema, collectionQuerySchema, updateCollectionSchema } from "../schemas/collection.schema.js";
import { collectionService } from "../services/collection.service.js";
import { getAuthenticatedUserId } from "../middlewares/authMiddleware.js";

const idSchema = z.coerce.number().int().positive();
const wantedCardSchema = z.object({
  cardId: z.string().min(1),
  name: z.string().min(1),
  image: z.string().url(),
  set: z.string().min(1),
  setId: z.string().optional(),
  number: z.string().optional()
});

export const collectionController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const query = collectionQuerySchema.parse(req.query);
      res.json(await collectionService.list(getAuthenticatedUserId(req), query));
    } catch (error) {
      next(error);
    }
  },

  async add(req: Request, res: Response, next: NextFunction) {
    try {
      const body = addCardSchema.parse(req.body);
      res.status(201).json(await collectionService.add(getAuthenticatedUserId(req), body));
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = idSchema.parse(req.params.id);
      const body = updateCollectionSchema.parse(req.body);
      res.json(await collectionService.update(getAuthenticatedUserId(req), id, body));
    } catch (error) {
      next(error);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const id = idSchema.parse(req.params.id);
      await collectionService.remove(getAuthenticatedUserId(req), id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },

  async clear(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await collectionService.clear(getAuthenticatedUserId(req)));
    } catch (error) {
      next(error);
    }
  },

  async refreshPrices(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await collectionService.refreshPrices(getAuthenticatedUserId(req)));
    } catch (error) {
      next(error);
    }
  },

  async missingBySet(req: Request, res: Response, next: NextFunction) {
    try {
      const set = z.string().min(1).parse(req.query.set);
      res.json(await collectionService.missingBySet(getAuthenticatedUserId(req), set));
    } catch (error) {
      next(error);
    }
  },

  async wanted(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await collectionService.wanted(getAuthenticatedUserId(req)));
    } catch (error) {
      next(error);
    }
  },

  async markWanted(req: Request, res: Response, next: NextFunction) {
    try {
      const body = wantedCardSchema.parse(req.body);
      res.status(201).json(await collectionService.markWanted(getAuthenticatedUserId(req), body));
    } catch (error) {
      next(error);
    }
  },

  async unmarkWanted(req: Request, res: Response, next: NextFunction) {
    try {
      const cardId = z.string().min(1).parse(req.params.cardId);
      await collectionService.unmarkWanted(getAuthenticatedUserId(req), cardId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },

  async trades(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await collectionService.trades(getAuthenticatedUserId(req)));
    } catch (error) {
      next(error);
    }
  },

  async dashboard(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await collectionService.dashboard(getAuthenticatedUserId(req)));
    } catch (error) {
      next(error);
    }
  }
};
