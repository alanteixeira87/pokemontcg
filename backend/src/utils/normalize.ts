import type { ExploreCard, PokemonCard } from "../types.js";

const fallbackImage =
  "https://images.pokemontcg.io/base1/4.png";

function getMarketPrice(card: PokemonCard): number | null {
  const prices = Object.values(card.tcgplayer?.prices ?? {});
  const market = prices.find((price) => typeof price.market === "number")?.market;
  const mid = prices.find((price) => typeof price.mid === "number")?.mid;
  return market ?? mid ?? null;
}

export function normalizeCard(card: PokemonCard): ExploreCard {
  return {
    id: card.id,
    name: card.name,
    image: card.images?.small ?? card.images?.large ?? fallbackImage,
    set: card.set?.name ?? "Colecao desconhecida",
    setId: card.set?.id,
    number: card.number,
    marketPrice: getMarketPrice(card)
  };
}
