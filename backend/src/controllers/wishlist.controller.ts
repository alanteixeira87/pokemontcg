import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { getAuthenticatedUserId } from "../middlewares/authMiddleware.js";
import { wishlistCardSchema } from "../schemas/collection.schema.js";
import { wishlistService } from "../services/wishlist.service.js";

const cardIdSchema = z.string().trim().min(1);

export const wishlistController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await wishlistService.list(getAuthenticatedUserId(req)));
    } catch (error) {
      next(error);
    }
  },

  async add(req: Request, res: Response, next: NextFunction) {
    try {
      const body = wishlistCardSchema.parse(req.body);
      res.status(201).json(await wishlistService.add(getAuthenticatedUserId(req), body));
    } catch (error) {
      next(error);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const cardId = cardIdSchema.parse(req.params.cardId);
      res.json(await wishlistService.remove(getAuthenticatedUserId(req), cardId));
    } catch (error) {
      next(error);
    }
  },

  async notifications(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await wishlistService.availability(getAuthenticatedUserId(req)));
    } catch (error) {
      next(error);
    }
  }
};
