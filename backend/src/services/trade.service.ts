import type { Collection, Prisma, TradeStatus, VariantType } from "@prisma/client";
import { prisma } from "../database/prisma.js";
import { HttpError } from "../utils/httpError.js";

export type TradeSelectionInput = {
  collectionId: number;
  variantType: VariantType;
  quantity: number;
};

type TradeCardSnapshot = {
  collectionId: number;
  cardId: string;
  name: string;
  image: string;
  set: string;
  number: string | null;
  variantType: VariantType;
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

const variantLabels: Record<VariantType, string> = {
  NORMAL: "Normal",
  FOIL: "Foil",
  REVERSE_FOIL: "Foil Reverse",
  RARE_ILLUSTRATION: "Ilustracao Rara"
};

function cardNumberValue(item: { number?: string | null; cardId: string }): number {
  const rawNumber = item.number ?? item.cardId.split("-").at(-1) ?? "";
  const parsed = Number(rawNumber.match(/\d+/)?.[0] ?? Number.MAX_SAFE_INTEGER);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function sanitizeMessage(message: string): string {
  return message.replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
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
        { collection: { some: { name: { contains: search, mode: "insensitive" }, variants: { some: { tradeQuantity: { gt: 0 } } } } } },
        { collection: { some: { set: { contains: search, mode: "insensitive" }, variants: { some: { tradeQuantity: { gt: 0 } } } } } }
      ]
    });
  }

  if (interest) {
    terms.push({
      OR: [
        { interests: { contains: interest, mode: "insensitive" } },
        { collection: { some: { name: { contains: interest, mode: "insensitive" }, variants: { some: { tradeQuantity: { gt: 0 } } } } } },
        { collection: { some: { set: { contains: interest, mode: "insensitive" }, variants: { some: { tradeQuantity: { gt: 0 } } } } } }
      ]
    });
  }

  return {
    id: { not: currentUserId },
    collection: { some: { variants: { some: { tradeQuantity: { gt: 0 } } } } },
    AND: terms
  };
}

function mergeSelections(selections: TradeSelectionInput[]): TradeSelectionInput[] {
  const map = new Map<string, TradeSelectionInput>();
  for (const selection of selections) {
    const key = `${selection.collectionId}:${selection.variantType}`;
    const current = map.get(key);
    map.set(key, {
      ...selection,
      quantity: (current?.quantity ?? 0) + selection.quantity
    });
  }
  return Array.from(map.values());
}

function fallbackSelections(ids?: number[]): TradeSelectionInput[] {
  return (ids ?? []).map((collectionId) => ({ collectionId, variantType: "NORMAL", quantity: 1 }));
}

function getSelections(input: { requestedCards?: TradeSelectionInput[]; offeredCards?: TradeSelectionInput[]; requestedCardIds?: number[]; offeredCardIds?: number[] }) {
  return {
    requested: mergeSelections(input.requestedCards?.length ? input.requestedCards : fallbackSelections(input.requestedCardIds)),
    offered: mergeSelections(input.offeredCards?.length ? input.offeredCards : fallbackSelections(input.offeredCardIds))
  };
}

async function getTradeCardsForUser(userId: number, filters: TradeCardsFilters = {}) {
  const cards = await prisma.collection.findMany({
    where: {
      userId,
      set: filters.set || undefined,
      name: filters.search ? { contains: filters.search, mode: "insensitive" } : undefined,
      variants: { some: { tradeQuantity: { gt: 0 } } }
    },
    include: {
      variants: {
        where: { tradeQuantity: { gt: 0 } },
        orderBy: { variantType: "asc" }
      }
    }
  });

  return sortTradeCards(cards).map((card) => ({
    ...card,
    variantSummary: card.variants.map((variant) => ({
      ...variant,
      label: variantLabels[variant.variantType]
    }))
  }));
}

async function validateSelections(userId: number, selections: TradeSelectionInput[], ownerLabel: string) {
  if (!selections.length) {
    throw new HttpError(400, `Selecione ao menos uma carta de ${ownerLabel}.`);
  }

  const cards = await prisma.collection.findMany({
    where: {
      id: { in: selections.map((selection) => selection.collectionId) },
      userId
    },
    include: { variants: true }
  });

  if (cards.length !== new Set(selections.map((selection) => selection.collectionId)).size) {
    throw new HttpError(400, `Uma ou mais cartas de ${ownerLabel} nao foram encontradas.`);
  }

  return selections.map((selection) => {
    const card = cards.find((item) => item.id === selection.collectionId);
    const variant = card?.variants.find((item) => item.variantType === selection.variantType);
    if (!card || !variant) {
      throw new HttpError(400, "Selecione o tipo da carta antes de disponibilizar para troca.");
    }

    if (variant.tradeQuantity <= 0) {
      throw new HttpError(400, `${card.name} (${variantLabels[selection.variantType]}) nao esta disponivel para troca.`);
    }

    if (selection.quantity > variant.tradeQuantity) {
      throw new HttpError(400, `Quantidade indisponivel para ${card.name} (${variantLabels[selection.variantType]}).`);
    }

    return { card, selection };
  });
}

function selectionToSnapshot(card: Collection, selection: TradeSelectionInput): TradeCardSnapshot {
  return {
    collectionId: card.id,
    cardId: card.cardId,
    name: card.name,
    image: card.image,
    set: card.set,
    number: card.number,
    variantType: selection.variantType,
    quantity: selection.quantity
  };
}

async function ensureParticipant(userId: number, tradeId: number) {
  const trade = await prisma.trade.findUnique({
    where: { id: tradeId },
    include: {
      requester: { select: { id: true, name: true, avatarUrl: true } },
      receiver: { select: { id: true, name: true, avatarUrl: true } }
    }
  });

  if (!trade) {
    throw new HttpError(404, "Proposta nao encontrada.");
  }

  if (trade.requesterId !== userId && trade.receiverId !== userId) {
    throw new HttpError(403, "Voce nao participa desta troca.");
  }

  return trade;
}

async function validateTradeStillAvailable(tradeId: number) {
  const tradeCards = await prisma.tradeCard.findMany({ where: { tradeId } });
  for (const item of tradeCards) {
    const variant = await prisma.cardVariant.findUnique({
      where: {
        userCardId_variantType: {
          userCardId: item.collectionId,
          variantType: item.variantType
        }
      }
    });

    if (!variant || variant.tradeQuantity < item.quantity) {
      throw new HttpError(400, `Estoque indisponivel para ${item.name} (${variantLabels[item.variantType]}).`);
    }
  }
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
          where: { variants: { some: { tradeQuantity: { gt: 0 } } } },
          select: { set: true },
          take: 80
        },
        _count: {
          select: { collection: { where: { variants: { some: { tradeQuantity: { gt: 0 } } } } } }
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
    return { user, sets: uniqueSets(cards), cards };
  },

  async listMyTradeCards(userId: number, filters: TradeCardsFilters = {}) {
    const cards = await getTradeCardsForUser(userId, filters);
    return { sets: uniqueSets(cards), cards };
  },

  async updateVariants(userId: number, collectionId: number, variants: Array<{ variantType: VariantType; ownedQuantity: number; tradeQuantity: number }>) {
    const card = await prisma.collection.findFirst({ where: { id: collectionId, userId } });
    if (!card) {
      throw new HttpError(404, "Carta nao encontrada na sua colecao.");
    }

    const totalOwned = variants.reduce((sum, item) => sum + item.ownedQuantity, 0);
    const invalid = variants.find((item) => item.tradeQuantity > item.ownedQuantity);
    if (invalid) {
      throw new HttpError(400, "Quantidade para troca nao pode ser maior que a quantidade possuida.");
    }

    await prisma.$transaction([
      prisma.cardVariant.deleteMany({ where: { userCardId: collectionId } }),
      ...variants
        .filter((variant) => variant.ownedQuantity > 0 || variant.tradeQuantity > 0)
        .map((variant) =>
          prisma.cardVariant.create({
            data: {
              userCardId: collectionId,
              variantType: variant.variantType,
              ownedQuantity: variant.ownedQuantity,
              tradeQuantity: variant.tradeQuantity
            }
          })
        ),
      prisma.collection.update({
        where: { id: collectionId },
        data: {
          quantity: Math.max(1, totalOwned || card.quantity),
          forTrade: variants.some((variant) => variant.tradeQuantity > 0)
        }
      })
    ]);

    return prisma.collection.findUnique({
      where: { id: collectionId },
      include: { variants: true }
    });
  },

  async createProposal(requesterId: number, input: { receiverId: number; requestedCards?: TradeSelectionInput[]; offeredCards?: TradeSelectionInput[]; requestedCardIds?: number[]; offeredCardIds?: number[] }) {
    if (requesterId === input.receiverId) {
      throw new HttpError(400, "Nao e possivel criar troca com voce mesmo.");
    }

    const selections = getSelections(input);
    const [requested, offered] = await Promise.all([
      validateSelections(input.receiverId, selections.requested, "quem vai receber a proposta"),
      validateSelections(requesterId, selections.offered, "quem esta oferecendo")
    ]);

    const duplicate = await prisma.trade.findFirst({
      where: {
        requesterId,
        receiverId: input.receiverId,
        status: "PENDING",
        offeredCards: { equals: sortTradeCards(offered.map((item) => selectionToSnapshot(item.card, item.selection))) },
        requestedCards: { equals: sortTradeCards(requested.map((item) => selectionToSnapshot(item.card, item.selection))) }
      }
    });
    if (duplicate) {
      throw new HttpError(409, "Ja existe uma proposta pendente igual a esta.");
    }

    const requestedSnapshots = sortTradeCards(requested.map((item) => selectionToSnapshot(item.card, item.selection)));
    const offeredSnapshots = sortTradeCards(offered.map((item) => selectionToSnapshot(item.card, item.selection)));

    return prisma.trade.create({
      data: {
        requesterId,
        receiverId: input.receiverId,
        requestedCards: requestedSnapshots,
        offeredCards: offeredSnapshots,
        cards: {
          create: [
            ...offeredSnapshots.map((card) => ({ ...card, side: "OFFERED" as const })),
            ...requestedSnapshots.map((card) => ({ ...card, side: "REQUESTED" as const }))
          ]
        }
      },
      include: {
        requester: { select: { id: true, name: true, avatarUrl: true } },
        receiver: { select: { id: true, name: true, avatarUrl: true } },
        cards: true,
        messages: { orderBy: { createdAt: "asc" } }
      }
    });
  },

  async listProposals(userId: number) {
    return prisma.trade.findMany({
      where: { OR: [{ requesterId: userId }, { receiverId: userId }] },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        requester: { select: { id: true, name: true, avatarUrl: true } },
        receiver: { select: { id: true, name: true, avatarUrl: true } },
        cards: true,
        messages: { orderBy: { createdAt: "asc" }, take: 100 }
      },
      take: 80
    });
  },

  async updateStatus(userId: number, tradeId: number, status: "ACCEPTED" | "REJECTED" | "CANCELLED") {
    const trade = await ensureParticipant(userId, tradeId);

    if (status === "CANCELLED" && trade.requesterId !== userId) {
      throw new HttpError(403, "Apenas quem enviou pode cancelar a proposta.");
    }

    if ((status === "ACCEPTED" || status === "REJECTED") && trade.receiverId !== userId) {
      throw new HttpError(403, "Apenas quem recebeu pode responder a proposta.");
    }

    if (trade.status !== "PENDING") {
      throw new HttpError(400, "Esta proposta ja foi respondida.");
    }

    if (status === "ACCEPTED") {
      await validateTradeStillAvailable(tradeId);
      const tradeCards = await prisma.tradeCard.findMany({ where: { tradeId } });
      await prisma.$transaction(
        tradeCards.map((item) =>
          prisma.cardVariant.update({
            where: { userCardId_variantType: { userCardId: item.collectionId, variantType: item.variantType } },
            data: { tradeQuantity: { decrement: item.quantity } }
          })
        )
      );
    }

    return prisma.trade.update({
      where: { id: tradeId },
      data: { status },
      include: {
        requester: { select: { id: true, name: true, avatarUrl: true } },
        receiver: { select: { id: true, name: true, avatarUrl: true } },
        cards: true,
        messages: { orderBy: { createdAt: "asc" } }
      }
    });
  },

  async listMessages(userId: number, tradeId: number) {
    await ensureParticipant(userId, tradeId);
    await prisma.tradeMessage.updateMany({
      where: { tradeId, receiverId: userId, isRead: false },
      data: { isRead: true }
    });

    return prisma.tradeMessage.findMany({
      where: { tradeId },
      orderBy: { createdAt: "asc" },
      take: 200
    });
  },

  async sendMessage(userId: number, tradeId: number, rawMessage: string) {
    const trade = await ensureParticipant(userId, tradeId);
    if (trade.status === "CANCELLED" || trade.status === "CANCELED") {
      throw new HttpError(400, "Nao e possivel enviar mensagem em troca cancelada.");
    }

    const message = sanitizeMessage(rawMessage);
    if (!message) {
      throw new HttpError(400, "Mensagem vazia nao e permitida.");
    }

    const receiverId = trade.requesterId === userId ? trade.receiverId : trade.requesterId;
    return prisma.tradeMessage.create({
      data: {
        tradeId,
        senderId: userId,
        receiverId,
        message
      }
    });
  }
};
