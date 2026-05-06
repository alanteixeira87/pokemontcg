import type { NextFunction, Request, Response } from "express";
import { adminService } from "../services/admin.service.js";

export const adminController = {
  async overview(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await adminService.overview());
    } catch (error) {
      next(error);
    }
  },

  async users(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await adminService.users());
    } catch (error) {
      next(error);
    }
  }
};
