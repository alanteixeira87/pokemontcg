import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { getAuthenticatedUserId } from "../middlewares/authMiddleware.js";
import {
  createTradeSchema,
  sendTradeMessageSchema,
  tradeCardsQuerySchema,
  updateTradeStatusSchema,
  updateVariantsSchema,
  userSearchSchema
} from "../schemas/trade.schema.js";
import { tradeService } from "../services/trade.service.js";

const idSchema = z.coerce.number().int().positive();

export const tradeController = {
  async searchUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const query = userSearchSchema.parse(req.query);
      res.json(await tradeService.searchUsers(getAuthenticatedUserId(req), query));
    } catch (error) {
      next(error);
    }
  },

  async userCards(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = idSchema.parse(req.params.userId);
      const query = tradeCardsQuerySchema.parse(req.query);
      res.json(await tradeService.listUserTradeCards(getAuthenticatedUserId(req), userId, query));
    } catch (error) {
      next(error);
    }
  },

  async myCards(req: Request, res: Response, next: NextFunction) {
    try {
      const query = tradeCardsQuerySchema.parse(req.query);
      res.json(await tradeService.listMyTradeCards(getAuthenticatedUserId(req), query));
    } catch (error) {
      next(error);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const body = createTradeSchema.parse(req.body);
      res.status(201).json(await tradeService.createProposal(getAuthenticatedUserId(req), body));
    } catch (error) {
      next(error);
    }
  },

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await tradeService.listProposals(getAuthenticatedUserId(req)));
    } catch (error) {
      next(error);
    }
  },

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const id = idSchema.parse(req.params.id);
      const body = updateTradeStatusSchema.parse(req.body);
      res.json(await tradeService.updateStatus(getAuthenticatedUserId(req), id, body.status));
    } catch (error) {
      next(error);
    }
  },

  async updateVariants(req: Request, res: Response, next: NextFunction) {
    try {
      const id = idSchema.parse(req.params.collectionId);
      const body = updateVariantsSchema.parse(req.body);
      res.json(await tradeService.updateVariants(getAuthenticatedUserId(req), id, body.variants));
    } catch (error) {
      next(error);
    }
  },

  async listMessages(req: Request, res: Response, next: NextFunction) {
    try {
      const id = idSchema.parse(req.params.id);
      res.json(await tradeService.listMessages(getAuthenticatedUserId(req), id));
    } catch (error) {
      next(error);
    }
  },

  async sendMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const id = idSchema.parse(req.params.id);
      const body = sendTradeMessageSchema.parse(req.body);
      res.status(201).json(await tradeService.sendMessage(getAuthenticatedUserId(req), id, body.message));
    } catch (error) {
      next(error);
    }
  }
};
