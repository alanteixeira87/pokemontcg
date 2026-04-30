import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../database/prisma.js";
import type { AuthUser } from "../types.js";
import { env } from "../utils/env.js";
import { HttpError } from "../utils/httpError.js";

type AuthResult = {
  token: string;
  user: AuthUser;
};

function signToken(user: AuthUser): string {
  return jwt.sign(user, env.jwtSecret, { expiresIn: "7d" });
}

function toAuthUser(user: { id: number; name: string; email: string }): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email
  };
}

export const authService = {
  async register(input: { name: string; email: string; password: string }): Promise<AuthResult> {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new HttpError(409, "Este e-mail ja esta cadastrado.");
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash
      }
    });
    const authUser = toAuthUser(user);
    return { token: signToken(authUser), user: authUser };
  },

  async login(input: { email: string; password: string }): Promise<AuthResult> {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      throw new HttpError(401, "E-mail ou senha invalidos.");
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw new HttpError(401, "E-mail ou senha invalidos.");
    }

    const authUser = toAuthUser(user);
    return { token: signToken(authUser), user: authUser };
  },

  verify(token: string): AuthUser {
    try {
      const payload = jwt.verify(token, env.jwtSecret);
      if (typeof payload === "string") {
        throw new Error("Invalid token");
      }

      return {
        id: Number(payload.id),
        name: String(payload.name),
        email: String(payload.email)
      };
    } catch {
      throw new HttpError(401, "Sessao expirada. Faca login novamente.");
    }
  }
};
