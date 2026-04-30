import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(160).transform((email) => email.toLowerCase()),
  password: z.string().min(6).max(72)
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(160).transform((email) => email.toLowerCase()),
  password: z.string().min(1).max(72)
});
