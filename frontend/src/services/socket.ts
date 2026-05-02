import { io, type Socket } from "socket.io-client";
import type { TradeMessage } from "../types";

const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const socketBaseUrl = isLocalhost ? "http://localhost:3001" : "https://name-pokemon-tcg-local-api.onrender.com";

let socket: Socket | null = null;

export function getTradeSocket() {
  const token = localStorage.getItem("pokemon-tcg-token");
  if (!token) return null;

  if (!socket || socket.disconnected) {
    socket = io(socketBaseUrl, {
      transports: ["websocket", "polling"],
      auth: { token }
    });
  }

  return socket;
}

export function joinTradeChat(tradeId: number) {
  getTradeSocket()?.emit("trade:join", tradeId);
}

export function sendRealtimeTradeMessage(tradeId: number, message: string) {
  getTradeSocket()?.emit("trade:message", { tradeId, message });
}

export function onTradeMessage(handler: (message: TradeMessage) => void) {
  const current = getTradeSocket();
  current?.on("trade:message", handler);
  return () => current?.off("trade:message", handler);
}

export function onTradeNotification(handler: (payload: { type: string; tradeId: number; message: string }) => void) {
  const current = getTradeSocket();
  current?.on("trade:notification", handler);
  return () => current?.off("trade:notification", handler);
}
