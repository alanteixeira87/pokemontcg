import type { ErrorRequestHandler } from "express";
import multer from "multer";
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

  if (error instanceof multer.MulterError) {
    const message = error.code === "LIMIT_FILE_SIZE"
      ? "A planilha e muito grande. Envie um arquivo .xlsx de ate 25MB."
      : "Nao foi possivel receber o arquivo da planilha.";
    res.status(400).json({ message });
    return;
  }

  console.error(JSON.stringify({ level: "error", message: "Unhandled error", error: String(error) }));
  res.status(500).json({ message: "Erro interno. Tente novamente em instantes." });
};
