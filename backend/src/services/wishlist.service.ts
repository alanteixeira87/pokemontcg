import { prisma } from "../database/prisma.js";
import { HttpError } from "../utils/httpError.js";

type WishlistInput = {
  cardId: string;
  name: string;
  image: string;
  set: string;
  number?: string;
  rarity?: string;
  variantType?: string;
  condition: string;
  marketPrice: number;
  priceSource: string;
};

export const wishlistService = {
  async list(userId: number) {
    const items = await prisma.wishlistItem.findMany({
      where: { userId },
      orderBy: [{ set: "asc" }, { number: "asc" }, { name: "asc" }]
    });

    const availability = await wishlistService.availability(userId);
    const availableByCardId = new Map(availability.map((item) => [item.cardId, item]));

    return items.map((item) => ({
      ...item,
      availability: availableByCardId.get(item.cardId) ?? null
    }));
  },

  async add(userId: number, input: WishlistInput) {
    return prisma.wishlistItem.upsert({
      where: { userId_cardId: { userId, cardId: input.cardId } },
      update: {
        name: input.name,
        image: input.image,
        set: input.set,
        number: input.number,
        rarity: input.rarity,
        variantType: input.variantType,
        condition: input.condition,
        marketPrice: input.marketPrice,
        priceSource: input.priceSource
      },
      create: { userId, ...input }
    });
  },

  async remove(userId: number, cardId: string) {
    await prisma.wishlistItem.deleteMany({ where: { userId, cardId } });
    return { removed: true };
  },

  async availability(userId: number) {
    const wishlist = await prisma.wishlistItem.findMany({ where: { userId } });
    if (!wishlist.length) return [];

    const wantedCardIds = Array.from(new Set(wishlist.map((item) => item.cardId)));
    const availableCards = await prisma.collection.findMany({
      where: {
        userId: { not: userId },
        cardId: { in: wantedCardIds },
        OR: [{ forTrade: true }, { quantity: { gt: 1 } }]
      },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: [{ set: "asc" }, { number: "asc" }, { name: "asc" }]
    });

    const seen = new Set<string>();
    return availableCards
      .map((card) => {
        const key = `${card.cardId}:${card.userId}`;
        if (seen.has(key)) return null;
        seen.add(key);
        return {
          cardId: card.cardId,
          name: card.name,
          image: card.image,
          set: card.set,
          number: card.number,
          condition: "Nao informado",
          variantType: "NORMAL",
          requestedPrice: card.price,
          owner: card.user,
          quantity: card.quantity
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  },

  async assertOwned(userId: number, cardId: string) {
    const item = await prisma.wishlistItem.findUnique({ where: { userId_cardId: { userId, cardId } } });
    if (!item) {
      throw new HttpError(404, "Carta nao encontrada na lista de desejos.");
    }
    return item;
  }
};
