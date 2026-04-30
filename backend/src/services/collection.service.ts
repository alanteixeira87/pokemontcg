import type { Prisma } from "@prisma/client";
import { prisma } from "../database/prisma.js";
import type { CollectionItem } from "../types.js";
import { HttpError } from "../utils/httpError.js";

type AddCardInput = {
  cardId: string;
  name: string;
  image: string;
  set: string;
  quantity: number;
  price: number;
};

type UpdateCardInput = {
  quantity?: number;
  price?: number;
  favorite?: boolean;
  forTrade?: boolean;
};

type ListFilters = {
  set?: string;
  favorite?: "true" | "false";
  forTrade?: "true" | "false";
  sort: "name" | "price" | "quantity";
};

function orderBy(sort: ListFilters["sort"]): Prisma.CollectionOrderByWithRelationInput {
  if (sort === "price") return { price: "desc" };
  if (sort === "quantity") return { quantity: "desc" };
  return { name: "asc" };
}

export const collectionService = {
  async list(filters: ListFilters): Promise<CollectionItem[]> {
    return prisma.collection.findMany({
      where: {
        set: filters.set || undefined,
        favorite: filters.favorite ? filters.favorite === "true" : undefined,
        forTrade: filters.forTrade ? filters.forTrade === "true" : undefined
      },
      orderBy: orderBy(filters.sort)
    });
  },

  async add(input: AddCardInput): Promise<CollectionItem> {
    const existing = await prisma.collection.findUnique({
      where: { cardId: input.cardId }
    });

    if (existing) {
      return prisma.collection.update({
        where: { cardId: input.cardId },
        data: {
          quantity: existing.quantity + input.quantity,
          price: input.price
        }
      });
    }

    return prisma.collection.create({
      data: {
        cardId: input.cardId,
        name: input.name,
        image: input.image,
        set: input.set,
        quantity: input.quantity,
        price: input.price
      }
    });
  },

  async update(id: number, input: UpdateCardInput): Promise<CollectionItem> {
    try {
      return await prisma.collection.update({
        where: { id },
        data: input
      });
    } catch {
      throw new HttpError(404, "Carta nao encontrada na colecao.");
    }
  },

  async remove(id: number): Promise<void> {
    try {
      await prisma.collection.delete({ where: { id } });
    } catch {
      throw new HttpError(404, "Carta nao encontrada na colecao.");
    }
  },

  async trades(): Promise<CollectionItem[]> {
    return prisma.collection.findMany({
      where: { forTrade: true },
      orderBy: { name: "asc" }
    });
  },

  async dashboard() {
    const items = await prisma.collection.findMany();
    const totalCards = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalValue = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
    const favorites = items.filter((item) => item.favorite).length;
    const forTrade = items.filter((item) => item.forTrade).length;

    return {
      totalCards,
      uniqueCards: items.length,
      totalValue,
      favorites,
      forTrade
    };
  }
};
