import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { HttpError } from "../utils/httpError.js";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      message: "Dados invalidos.",
      issues: error.issues.map((issue) => issue.message)
    });
    return;
  }

  if (error instanceof HttpError) {
    res.status(error.statusCode).json({ message: error.message });
    return;
  }

  console.error(JSON.stringify({ level: "error", message: "Unhandled error", error: String(error) }));
  res.status(500).json({ message: "Erro interno. Tente novamente em instantes." });
};
