import type { NextFunction, Request, Response } from "express";
import { loginSchema, registerSchema } from "../schemas/auth.schema.js";
import { authService } from "../services/auth.service.js";

export const authController = {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const body = registerSchema.parse(req.body);
      res.status(201).json(await authService.register(body));
    } catch (error) {
      next(error);
    }
  },

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const body = loginSchema.parse(req.body);
      res.json(await authService.login(body));
    } catch (error) {
      next(error);
    }
  },

  async me(req: Request, res: Response) {
    res.json({ user: req.user });
  }
};
