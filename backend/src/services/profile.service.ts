import { prisma } from "../database/prisma.js";
import { HttpError } from "../utils/httpError.js";

type ProfileInput = {
  name?: string;
  avatarUrl?: string;
  interests?: string;
};

export const profileService = {
  async get(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        interests: true,
        createdAt: true,
        _count: {
          select: {
            collection: true,
            sentTrades: true,
            receivedTrades: true,
            wishlist: true
          }
        }
      }
    });

    if (!user) throw new HttpError(404, "Usuario nao encontrado.");
    return user;
  },

  async update(userId: number, input: ProfileInput) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        name: input.name,
        avatarUrl: input.avatarUrl === "" ? null : input.avatarUrl,
        interests: input.interests === "" ? null : input.interests
      },
      select: { id: true, name: true, email: true, avatarUrl: true, interests: true }
    });

    return { user };
  }
};
