import type { NextFunction, Request, Response } from "express";
import { authService } from "../services/auth.service.js";
import { HttpError } from "../utils/httpError.js";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        name: string;
        email: string;
      };
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const queryToken = typeof req.query.token === "string" ? req.query.token : null;
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    const authToken = token ?? queryToken;
    if (!authToken) {
      throw new HttpError(401, "Login necessario para acessar este recurso.");
    }

    req.user = authService.verify(authToken);
    next();
  } catch (error) {
    next(error);
  }
}

export function getAuthenticatedUserId(req: Request): number {
  if (!req.user?.id) {
    throw new HttpError(401, "Login necessario para acessar este recurso.");
  }
  return req.user.id;
}

export function requireMasterAdmin(req: Request, _res: Response, next: NextFunction) {
  try {
    if (req.user?.email.toLowerCase() !== "alanteixeira74@gmail.com") {
      throw new HttpError(403, "Acesso master restrito ao administrador principal.");
    }
    next();
  } catch (error) {
    next(error);
  }
}
