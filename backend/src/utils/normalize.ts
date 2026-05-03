import type { ExploreCard, PokemonCard } from "../types.js";
import { env } from "./env.js";

const fallbackImage =
  "https://images.pokemontcg.io/base1/4.png";

function roundMoney(value: number): number {
  return Math.max(0, Math.round(value * 100) / 100);
}

function firstNumber(values: Array<number | undefined>): number | null {
  return values.find((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0) ?? null;
}

function getTcgPlayerUsd(card: PokemonCard): number | null {
  const prices = Object.values(card.tcgplayer?.prices ?? {});
  const preferredOrder = ["market", "mid", "low", "directLow", "high"] as const;

  for (const key of preferredOrder) {
    const value = firstNumber(prices.map((price) => price[key]));
    if (value) return value;
  }

  return null;
}

function getCardmarketEur(card: PokemonCard): number | null {
  const prices = card.cardmarket?.prices;
  if (!prices) return null;
  return firstNumber([
    prices.averageSellPrice,
    prices.trendPrice,
    prices.avg7,
    prices.avg30,
    prices.avg1,
    prices.lowPrice
  ]);
}

function localMarketMultiplier(card: PokemonCard): number {
  const rarity = (card.rarity ?? "").toLowerCase();
  const name = card.name.toLowerCase();
  if (rarity.includes("special illustration")) return 1.8;
  if (rarity.includes("illustration")) return 1.7;
  if (rarity.includes("hyper") || rarity.includes("secret")) return 1.8;
  if (rarity.includes("ultra") || name.includes(" ex") || name.includes(" vstar")) return 1.6;
  if (rarity.includes("rare")) return 1.4;
  return 1.3;
}

function getMarketPrice(card: PokemonCard): number | null {
  const usd = getTcgPlayerUsd(card);
  if (usd) {
    return roundMoney(usd * env.usdBrlRate * localMarketMultiplier(card));
  }

  const eur = getCardmarketEur(card);
  if (eur) {
    return roundMoney(eur * env.eurBrlRate * localMarketMultiplier(card));
  }

  return null;
}

export function normalizeCard(card: PokemonCard): ExploreCard {
  return {
    id: card.id,
    name: card.name,
    image: card.images?.small ?? card.images?.large ?? fallbackImage,
    set: card.set?.name ?? "Colecao desconhecida",
    setId: card.set?.id,
    number: card.number,
    rarity: card.rarity,
    marketPrice: getMarketPrice(card)
  };
}
