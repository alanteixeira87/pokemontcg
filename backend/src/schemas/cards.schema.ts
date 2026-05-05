import { z } from "zod";

export const cardsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(24),
  search: z.string().trim().max(80).optional(),
  set: z.string().trim().max(80).optional(),
  sort: z.enum(["numberAsc", "numberDesc", "name"]).default("numberAsc")
});

export const exportQuerySchema = z.object({
  type: z.enum(["full", "set", "card"]).default("full"),
  set: z.string().trim().optional(),
  id: z.string().trim().optional()
});
