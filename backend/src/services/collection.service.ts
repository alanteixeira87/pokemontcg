import type { Prisma } from "@prisma/client";
import { prisma } from "../database/prisma.js";
import type { CollectionItem } from "../types.js";
import { HttpError } from "../utils/httpError.js";
import { priceService } from "./price.service.js";

type AddCardInput = {
  cardId: string;
  name: string;
  image: string;
  set: string;
  quantity: number;
  price: number;
  number?: string;
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
  sort: "name" | "price" | "quantity" | "numberAsc" | "numberDesc";
};

function orderBy(sort: ListFilters["sort"]): Prisma.CollectionOrderByWithRelationInput {
  if (sort === "price") return { price: "desc" };
  if (sort === "quantity") return { quantity: "desc" };
  return { name: "asc" };
}

function cardNumberValue(item: CollectionItem): number {
  const rawNumber = item.number ?? item.cardId.split("-").at(-1) ?? "";
  const parsed = Number(rawNumber.match(/\d+/)?.[0] ?? Number.MAX_SAFE_INTEGER);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function sortCollectionItems(items: CollectionItem[], sort: ListFilters["sort"]): CollectionItem[] {
  if (sort !== "numberAsc" && sort !== "numberDesc") return items;

  const direction = sort === "numberDesc" ? -1 : 1;
  return [...items].sort((a, b) => {
    const diff = cardNumberValue(a) - cardNumberValue(b);
    if (diff !== 0) return diff * direction;
    return a.name.localeCompare(b.name);
  });
}

export const collectionService = {
  async list(userId: number, filters: ListFilters): Promise<CollectionItem[]> {
    const items = await prisma.collection.findMany({
      where: {
        userId,
        set: filters.set || undefined,
        favorite: filters.favorite ? filters.favorite === "true" : undefined,
        forTrade: filters.forTrade ? filters.forTrade === "true" : undefined
      },
      orderBy: orderBy(filters.sort)
    });

    return sortCollectionItems(items, filters.sort);
  },

  async add(userId: number, input: AddCardInput): Promise<CollectionItem> {
    const estimatedPrice = await priceService.estimate({
      name: input.name,
      set: input.set,
      number: input.number,
      fallback: input.price
    });

    const existing = await prisma.collection.findUnique({
      where: { userId_cardId: { userId, cardId: input.cardId } }
    });

    if (existing) {
      return prisma.collection.update({
        where: { id: existing.id },
        data: {
          quantity: existing.quantity + input.quantity,
          price: estimatedPrice
        }
      });
    }

    return prisma.collection.create({
      data: {
        userId,
        cardId: input.cardId,
        name: input.name,
        image: input.image,
        set: input.set,
        number: input.number,
        quantity: input.quantity,
        price: estimatedPrice
      }
    });
  },

  async update(userId: number, id: number, input: UpdateCardInput): Promise<CollectionItem> {
    const existing = await prisma.collection.findFirst({ where: { id, userId } });
    if (!existing) {
      throw new HttpError(404, "Carta nao encontrada na colecao.");
    }

    return prisma.collection.update({
      where: { id },
      data: input
    });
  },

  async remove(userId: number, id: number): Promise<void> {
    const existing = await prisma.collection.findFirst({ where: { id, userId } });
    if (!existing) {
      throw new HttpError(404, "Carta nao encontrada na colecao.");
    }

    await prisma.collection.delete({ where: { id } });
  },

  async clear(userId: number): Promise<{ deleted: number }> {
    const result = await prisma.collection.deleteMany({
      where: { userId }
    });

    return { deleted: result.count };
  },

  async trades(userId: number): Promise<CollectionItem[]> {
    return prisma.collection.findMany({
      where: { userId, forTrade: true },
      orderBy: { name: "asc" }
    });
  },

  async dashboard(userId: number) {
    const items = await prisma.collection.findMany({ where: { userId } });
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
