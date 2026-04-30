import { z } from "zod";

export const addCardSchema = z.object({
  cardId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(160),
  image: z.string().trim().url(),
  set: z.string().trim().min(1).max(160),
  quantity: z.coerce.number().int().min(1).default(1),
  price: z.coerce.number().min(0).default(0)
});

export const updateCollectionSchema = z.object({
  quantity: z.coerce.number().int().min(1).optional(),
  price: z.coerce.number().min(0).optional(),
  favorite: z.boolean().optional(),
  forTrade: z.boolean().optional()
});

export const collectionQuerySchema = z.object({
  set: z.string().trim().optional(),
  favorite: z.enum(["true", "false"]).optional(),
  forTrade: z.enum(["true", "false"]).optional(),
  sort: z.enum(["name", "price", "quantity"]).default("name")
});
