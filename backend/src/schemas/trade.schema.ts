import { z } from "zod";

export const userSearchSchema = z.object({
  search: z.string().trim().max(80).optional(),
  interest: z.string().trim().max(80).optional()
});

export const tradeCardsQuerySchema = z.object({
  set: z.string().trim().max(160).optional(),
  search: z.string().trim().max(80).optional()
});

export const createTradeSchema = z.object({
  receiverId: z.coerce.number().int().positive(),
  requestedCardIds: z.array(z.coerce.number().int().positive()).min(1).max(20),
  offeredCardIds: z.array(z.coerce.number().int().positive()).min(1).max(20)
});

export const updateTradeStatusSchema = z.object({
  status: z.enum(["ACCEPTED", "DECLINED", "CANCELED"])
});
