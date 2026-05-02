import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { authService } from "./auth.service.js";
import { tradeService } from "./trade.service.js";
import { env } from "../utils/env.js";

function isAllowedOrigin(origin?: string): boolean {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    if (["localhost", "127.0.0.1"].includes(url.hostname)) return true;
    if (url.protocol === "https:" && url.hostname.endsWith(".vercel.app")) return true;
  } catch {
    return false;
  }

  const allowed = env.frontendUrl
    ? env.frontendUrl
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    : [];
  return allowed.includes(origin);
}

export function initSocket(server: HttpServer) {
  const io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        callback(null, isAllowedOrigin(origin));
      }
    }
  });

  io.use((socket, next) => {
    try {
      const token = typeof socket.handshake.auth.token === "string" ? socket.handshake.auth.token : "";
      const user = authService.verify(token);
      socket.data.user = user;
      socket.join(`user:${user.id}`);
      next();
    } catch (error) {
      next(error instanceof Error ? error : new Error("Socket nao autorizado."));
    }
  });

  io.on("connection", (socket) => {
    socket.on("trade:join", async (tradeId: number) => {
      const user = socket.data.user as { id: number };
      try {
        await tradeService.listMessages(user.id, Number(tradeId));
        socket.join(`trade:${tradeId}`);
      } catch {
        socket.emit("trade:error", { message: "Nao foi possivel entrar no chat." });
      }
    });

    socket.on("trade:message", async (payload: { tradeId: number; message: string }) => {
      const user = socket.data.user as { id: number };
      try {
        const message = await tradeService.sendMessage(user.id, Number(payload.tradeId), String(payload.message ?? ""));
        io.to(`trade:${payload.tradeId}`).emit("trade:message", message);
        io.to(`user:${message.receiverId}`).emit("trade:notification", {
          type: "message",
          tradeId: message.tradeId,
          message: "Nova mensagem em uma negociacao."
        });
      } catch {
        socket.emit("trade:error", { message: "Nao foi possivel enviar a mensagem." });
      }
    });
  });

  return io;
}
