import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { cardsRoutes } from "./routes/cards.routes.js";
import { collectionRoutes } from "./routes/collection.routes.js";
import { exportRoutes } from "./routes/export.routes.js";
import { importRoutes } from "./routes/import.routes.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { env } from "./utils/env.js";

export const app = express();

function isAllowedLocalOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return ["localhost", "127.0.0.1"].includes(url.hostname);
  } catch {
    return false;
  }
}

function isAllowedConfiguredOrigin(origin: string): boolean {
  if (!env.frontendUrl) return false;
  const configuredOrigins = env.frontendUrl
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return configuredOrigins.includes(origin);
}

function isAllowedVercelOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.protocol === "https:" && url.hostname.endsWith(".vercel.app");
  } catch {
    return false;
  }
}

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || isAllowedLocalOrigin(origin) || isAllowedConfiguredOrigin(origin) || isAllowedVercelOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origem nao permitida pelo CORS."));
    }
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(morgan("combined"));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", cardsRoutes);
app.use("/api", collectionRoutes);
app.use("/api", exportRoutes);
app.use("/api", importRoutes);
app.use("/", cardsRoutes);
app.use("/", collectionRoutes);
app.use("/", exportRoutes);
app.use("/", importRoutes);
app.use(errorHandler);
