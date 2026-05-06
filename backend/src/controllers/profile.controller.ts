import type { NextFunction, Request, Response } from "express";
import { getAuthenticatedUserId } from "../middlewares/authMiddleware.js";
import { updateProfileSchema } from "../schemas/profile.schema.js";
import { profileService } from "../services/profile.service.js";

export const profileController = {
  async get(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await profileService.get(getAuthenticatedUserId(req)));
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const body = updateProfileSchema.parse(req.body);
      res.json(await profileService.update(getAuthenticatedUserId(req), body));
    } catch (error) {
      next(error);
    }
  }
};
