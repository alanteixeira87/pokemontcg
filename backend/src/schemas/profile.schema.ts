import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  avatarUrl: z.string().trim().url().or(z.literal("")).optional(),
  interests: z.string().trim().max(500).or(z.literal("")).optional()
});
