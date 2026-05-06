import type { Prisma } from "@prisma/client";
import { prisma } from "../database/prisma.js";
import type { CollectionItem } from "../types.js";
import { HttpError } from "../utils/httpError.js";
import { priceService } from "./price.service.js";
import { pokemonService } from "./pokemon.service.js";

type AddCardInput = {
  cardId: string;
  name: string;
  image: string;
  set: string;
  quantity: number;
  price: number;
  number?: string;
  rarity?: string;
};

type PreparedCardInput = AddCardInput & {
  estimatedPrice: number;
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

async function prepareCardInputs(inputs: AddCardInput[]): Promise<PreparedCardInput[]> {
  return Promise.all(
    inputs.map(async (input) => ({
      ...input,
      estimatedPrice: await priceService.estimate({
        name: input.name,
        set: input.set,
        number: input.number,
        fallback: input.price
      })
    }))
  );
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
    const [prepared] = await prepareCardInputs([input]);
    const estimatedPrice = prepared.estimatedPrice;

    const existing = await prisma.collection.findUnique({
      where: { userId_cardId: { userId, cardId: input.cardId } }
    });

    if (existing) {
      return prisma.collection.update({
        where: { id: existing.id },
        data: {
          quantity: existing.quantity + input.quantity,
          price: estimatedPrice,
          name: input.name,
          image: input.image,
          set: input.set,
          number: input.number,
          rarity: input.rarity
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
        rarity: input.rarity,
        quantity: input.quantity,
        price: estimatedPrice
      }
    });
  },

  async addMany(userId: number, inputs: AddCardInput[]): Promise<number> {
    if (!inputs.length) return 0;

    const preparedInputs = await prepareCardInputs(inputs);
    const chunkSize = 100;

    for (let index = 0; index < preparedInputs.length; index += chunkSize) {
      const chunk = preparedInputs.slice(index, index + chunkSize);
      await prisma.$transaction(
        chunk.map((input) =>
          prisma.collection.upsert({
            where: { userId_cardId: { userId, cardId: input.cardId } },
            update: {
              quantity: { increment: input.quantity },
              price: input.estimatedPrice,
              name: input.name,
              image: input.image,
              set: input.set,
              number: input.number,
              rarity: input.rarity
            },
            create: {
              userId,
              cardId: input.cardId,
              name: input.name,
              image: input.image,
              set: input.set,
              number: input.number,
              rarity: input.rarity,
              quantity: input.quantity,
              price: input.estimatedPrice
            }
          })
        )
      );
    }

    return inputs.reduce((sum, input) => sum + input.quantity, 0);
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

  async refreshPrices(userId: number): Promise<{ updated: number; skipped: number }> {
    const items = await prisma.collection.findMany({ where: { userId } });
    let updated = 0;
    let skipped = 0;

    for (const item of items) {
      const apiCard = await pokemonService.findCardById(item.cardId);
      const marketPrice = apiCard?.marketPrice ?? null;
      const estimatedPrice = await priceService.estimate({
        name: item.name,
        set: item.set,
        number: item.number ?? undefined,
        fallback: marketPrice ?? item.price
      });

      if (estimatedPrice > 0 && Math.abs(estimatedPrice - item.price) >= 0.01) {
        await prisma.collection.update({
          where: { id: item.id },
          data: { price: estimatedPrice }
        });
        updated += 1;
      } else {
        skipped += 1;
      }
    }

    return { updated, skipped };
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
