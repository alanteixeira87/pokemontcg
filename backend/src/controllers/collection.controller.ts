import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { addCardSchema, collectionQuerySchema, updateCollectionSchema } from "../schemas/collection.schema.js";
import { collectionService } from "../services/collection.service.js";

const idSchema = z.coerce.number().int().positive();

export const collectionController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const query = collectionQuerySchema.parse(req.query);
      res.json(await collectionService.list(query));
    } catch (error) {
      next(error);
    }
  },

  async add(req: Request, res: Response, next: NextFunction) {
    try {
      const body = addCardSchema.parse(req.body);
      res.status(201).json(await collectionService.add(body));
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = idSchema.parse(req.params.id);
      const body = updateCollectionSchema.parse(req.body);
      res.json(await collectionService.update(id, body));
    } catch (error) {
      next(error);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const id = idSchema.parse(req.params.id);
      await collectionService.remove(id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },

  async trades(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await collectionService.trades());
    } catch (error) {
      next(error);
    }
  },

  async dashboard(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await collectionService.dashboard());
    } catch (error) {
      next(error);
    }
  }
};
