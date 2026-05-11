import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/httpError.js";

type RateLimitOptions = {
  windowMs: number;
  max: number;
};

type Counter = {
  count: number;
  resetAt: number;
};

const store = new Map<string, Counter>();

export function createRateLimit(options: RateLimitOptions) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = `${req.user?.id ?? "anon"}:${req.ip ?? "ip"}`;
    const entry = store.get(key);

    if (!entry || now >= entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    if (entry.count >= options.max) {
      next(new HttpError(429, "Muitas tentativas de scanner. Aguarde alguns segundos e tente novamente."));
      return;
    }

    entry.count += 1;
    store.set(key, entry);
    next();
  };
}
