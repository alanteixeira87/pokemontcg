import { prisma } from "../database/prisma.js";

export const adminService = {
  async overview() {
    const [users, collectionCards, wishlistItems, trades, cachedCards, cachedSets, priceRows] = await Promise.all([
      prisma.user.count(),
      prisma.collection.count(),
      prisma.wishlistItem.count(),
      prisma.trade.count(),
      prisma.cachedCard.count(),
      prisma.cachedSet.count(),
      prisma.priceHistory.count()
    ]);

    const recentErrors: string[] = [];
    const latestPrices = await prisma.priceHistory.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        cardName: true,
        collectionName: true,
        estimatedPrice: true,
        source: true,
        confidence: true,
        status: true,
        createdAt: true
      }
    });

    return {
      users,
      collectionCards,
      wishlistItems,
      trades,
      cachedCards,
      cachedSets,
      priceRows,
      latestPrices,
      recentErrors
    };
  }
};
