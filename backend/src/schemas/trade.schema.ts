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
  requestedCards: z
    .array(
      z.object({
        collectionId: z.coerce.number().int().positive(),
        variantType: z.enum(["NORMAL", "FOIL", "REVERSE_FOIL", "RARE_ILLUSTRATION"]),
        quantity: z.coerce.number().int().min(1).max(99)
      })
    )
    .min(1)
    .max(20),
  offeredCards: z
    .array(
      z.object({
        collectionId: z.coerce.number().int().positive(),
        variantType: z.enum(["NORMAL", "FOIL", "REVERSE_FOIL", "RARE_ILLUSTRATION"]),
        quantity: z.coerce.number().int().min(1).max(99)
      })
    )
    .min(1)
    .max(20),
  requestedCardIds: z.array(z.coerce.number().int().positive()).max(20).optional(),
  offeredCardIds: z.array(z.coerce.number().int().positive()).max(20).optional()
});

export const updateTradeStatusSchema = z.object({
  status: z.enum(["ACCEPTED", "REJECTED", "CANCELLED"])
});

export const updateVariantsSchema = z.object({
  variants: z
    .array(
      z.object({
        variantType: z.enum(["NORMAL", "FOIL", "REVERSE_FOIL", "RARE_ILLUSTRATION"]),
        ownedQuantity: z.coerce.number().int().min(0).max(999),
        tradeQuantity: z.coerce.number().int().min(0).max(999)
      })
    )
    .min(1)
    .max(4)
});

export const sendTradeMessageSchema = z.object({
  message: z.string().trim().min(1).max(1000)
});
