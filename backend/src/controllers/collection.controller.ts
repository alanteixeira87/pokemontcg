import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { addCardSchema, collectionQuerySchema, updateCollectionSchema } from "../schemas/collection.schema.js";
import { collectionService } from "../services/collection.service.js";
import { getAuthenticatedUserId } from "../middlewares/authMiddleware.js";

const idSchema = z.coerce.number().int().positive();

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
