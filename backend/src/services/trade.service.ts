import type { Collection, Prisma, TradeStatus } from "@prisma/client";
import { prisma } from "../database/prisma.js";
import { HttpError } from "../utils/httpError.js";

type TradeCardSnapshot = {
  collectionId: number;
  cardId: string;
  name: string;
  image: string;
  set: string;
  number: string | null;
  quantity: number;
};

type UserSearchFilters = {
  search?: string;
  interest?: string;
};

type TradeCardsFilters = {
  set?: string;
  search?: string;
};

function cardNumberValue(item: { number?: string | null; cardId: string }): number {
  const rawNumber = item.number ?? item.cardId.split("-").at(-1) ?? "";
  const parsed = Number(rawNumber.match(/\d+/)?.[0] ?? Number.MAX_SAFE_INTEGER);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function collectionToSnapshot(item: Collection): TradeCardSnapshot {
  return {
    collectionId: item.id,
    cardId: item.cardId,
    name: item.name,
    image: item.image,
    set: item.set,
    number: item.number,
    quantity: item.quantity
  };
}

function sortTradeCards<T extends { set: string; name: string; number?: string | null; cardId: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const setDiff = a.set.localeCompare(b.set);
    if (setDiff !== 0) return setDiff;
    const numberDiff = cardNumberValue(a) - cardNumberValue(b);
    if (numberDiff !== 0) return numberDiff;
    return a.name.localeCompare(b.name);
  });
}

function uniqueSets(items: Array<{ set: string }>): string[] {
  return Array.from(new Set(items.map((item) => item.set))).sort((a, b) => a.localeCompare(b));
}

function buildUserWhere(currentUserId: number, filters: UserSearchFilters): Prisma.UserWhereInput {
  const search = filters.search?.trim();
  const interest = filters.interest?.trim();
  const terms: Prisma.UserWhereInput[] = [];

  if (search) {
    terms.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { collection: { some: { name: { contains: search, mode: "insensitive" }, forTrade: true } } },
        { collection: { some: { set: { contains: search, mode: "insensitive" }, forTrade: true } } }
      ]
    });
  }

  if (interest) {
    terms.push({
      OR: [
        { interests: { contains: interest, mode: "insensitive" } },
        { collection: { some: { name: { contains: interest, mode: "insensitive" }, forTrade: true } } },
        { collection: { some: { set: { contains: interest, mode: "insensitive" }, forTrade: true } } }
      ]
    });
  }

  return {
    id: { not: currentUserId },
    collection: { some: { forTrade: true, quantity: { gt: 0 } } },
    AND: terms
  };
}

async function getTradeCardsForUser(userId: number, filters: TradeCardsFilters = {}) {
  const cards = await prisma.collection.findMany({
    where: {
      userId,
      forTrade: true,
      quantity: { gt: 0 },
      set: filters.set || undefined,
      name: filters.search ? { contains: filters.search, mode: "insensitive" } : undefined
    },
    select: {
      id: true,
      cardId: true,
      name: true,
      image: true,
      set: true,
      number: true,
      quantity: true,
      price: true,
      favorite: true,
      forTrade: true,
      createdAt: true,
      updatedAt: true,
      userId: true
    }
  });

  return sortTradeCards(cards);
}

export const tradeService = {
  async searchUsers(currentUserId: number, filters: UserSearchFilters) {
    const users = await prisma.user.findMany({
      where: buildUserWhere(currentUserId, filters),
      take: 30,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        interests: true,
        collection: {
          where: { forTrade: true, quantity: { gt: 0 } },
          select: { set: true },
          take: 80
        },
        _count: {
          select: { collection: { where: { forTrade: true, quantity: { gt: 0 } } } }
        }
      }
    });

    return users.map((user) => ({
      id: user.id,
      name: user.name,
      avatarUrl: user.avatarUrl,
      interests: user.interests,
      tradeCardsCount: user._count.collection,
      mainCollections: uniqueSets(user.collection).slice(0, 4)
    }));
  },

  async listUserTradeCards(currentUserId: number, userId: number, filters: TradeCardsFilters) {
    if (currentUserId === userId) {
      throw new HttpError(400, "Use sua colecao para gerenciar suas proprias cartas.");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, avatarUrl: true }
    });

    if (!user) {
      throw new HttpError(404, "Usuario nao encontrado.");
    }

    const cards = await getTradeCardsForUser(userId, filters);
    return {
      user,
      sets: uniqueSets(cards),
      cards
    };
  },

  async listMyTradeCards(userId: number, filters: TradeCardsFilters = {}) {
    const cards = await getTradeCardsForUser(userId, filters);
    return {
      sets: uniqueSets(cards),
      cards
    };
  },

  async createProposal(requesterId: number, input: { receiverId: number; requestedCardIds: number[]; offeredCardIds: number[] }) {
    if (requesterId === input.receiverId) {
      throw new HttpError(400, "Nao e possivel criar troca com voce mesmo.");
    }

    const [requestedCards, offeredCards] = await Promise.all([
      prisma.collection.findMany({
        where: { id: { in: input.requestedCardIds }, userId: input.receiverId, forTrade: true, quantity: { gt: 0 } }
      }),
      prisma.collection.findMany({
        where: { id: { in: input.offeredCardIds }, userId: requesterId, forTrade: true, quantity: { gt: 0 } }
      })
    ]);

    if (requestedCards.length !== new Set(input.requestedCardIds).size) {
      throw new HttpError(400, "Uma ou mais cartas solicitadas nao estao disponiveis para troca.");
    }

    if (offeredCards.length !== new Set(input.offeredCardIds).size) {
      throw new HttpError(400, "Uma ou mais cartas oferecidas nao estao disponiveis para troca.");
    }

    return prisma.trade.create({
      data: {
        requesterId,
        receiverId: input.receiverId,
        requestedCards: sortTradeCards(requestedCards).map(collectionToSnapshot),
        offeredCards: sortTradeCards(offeredCards).map(collectionToSnapshot)
      },
      include: {
        requester: { select: { id: true, name: true, avatarUrl: true } },
        receiver: { select: { id: true, name: true, avatarUrl: true } }
      }
    });
  },

  async listProposals(userId: number) {
    return prisma.trade.findMany({
      where: {
        OR: [{ requesterId: userId }, { receiverId: userId }]
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        requester: { select: { id: true, name: true, avatarUrl: true } },
        receiver: { select: { id: true, name: true, avatarUrl: true } }
      },
      take: 80
    });
  },

  async updateStatus(userId: number, tradeId: number, status: Exclude<TradeStatus, "PENDING">) {
    const trade = await prisma.trade.findUnique({ where: { id: tradeId } });
    if (!trade) {
      throw new HttpError(404, "Proposta nao encontrada.");
    }

    if (status === "CANCELED" && trade.requesterId !== userId) {
      throw new HttpError(403, "Apenas quem enviou pode cancelar a proposta.");
    }

    if ((status === "ACCEPTED" || status === "DECLINED") && trade.receiverId !== userId) {
      throw new HttpError(403, "Apenas quem recebeu pode responder a proposta.");
    }

    if (trade.status !== "PENDING") {
      throw new HttpError(400, "Esta proposta ja foi respondida.");
    }

    return prisma.trade.update({
      where: { id: tradeId },
      data: { status },
      include: {
        requester: { select: { id: true, name: true, avatarUrl: true } },
        receiver: { select: { id: true, name: true, avatarUrl: true } }
      }
    });
  }
};
