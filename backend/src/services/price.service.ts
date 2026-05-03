import axios from "axios";
import { env } from "../utils/env.js";

export type PriceVariantType =
  | "NORMAL"
  | "FOIL"
  | "REVERSE_FOIL"
  | "HOLO"
  | "FULL_ART"
  | "ALTERNATE_ART"
  | "SECRET_RARE"
  | "PROMO"
  | "ILLUSTRATION_RARE"
  | "SPECIAL_ILLUSTRATION_RARE"
  | "HYPER_RARE"
  | "ULTRA_RARE";

export type CardClass =
  | "COMMON"
  | "UNCOMMON"
  | "RARE"
  | "DOUBLE_RARE"
  | "ULTRA_RARE"
  | "ILLUSTRATION_RARE"
  | "SPECIAL_ILLUSTRATION_RARE"
  | "HYPER_RARE"
  | "PROMO"
  | "SECRET_RARE";

type PriceSource =
  | "INTERNAL_MARKETPLACE"
  | "BRAZIL_REFERENCE"
  | "INTERNAL_HISTORY"
  | "INTERNATIONAL_API"
  | "ESTIMATE"
  | "MANUAL_VALUE";

type PriceConfidence = "HIGH" | "MEDIUM" | "LOW";
type PriceStatus = "CONFIRMED" | "ESTIMATED" | "PRICE_PENDING" | "MANUAL";

export type CardPrice = {
  cardName: string;
  collectionName: string;
  setCode: string;
  cardNumber: string;
  variantType: PriceVariantType;
  cardClass: CardClass;
  minPrice: number;
  avgPrice: number;
  maxPrice: number;
  estimatedPrice: number;
  source: PriceSource;
  confidence: PriceConfidence;
  status: PriceStatus;
  updatedAt: Date;
  message?: string;
};

type PriceLookupInput = {
  cardId?: string;
  cardName: string;
  collectionName: string;
  setCode?: string;
  cardNumber?: string;
  language?: "PT_BR" | "EN" | "UNKNOWN";
  rarity?: string;
  cardClass?: string;
  variantType?: string;
  condition?: string;
  manualValue?: number | null;
  fallback?: number | null;
};

type MarketListing = {
  cardId: string;
  storeId: string;
  price: number;
  condition: string;
  createdAt: Date;
};

type PokeWalletSearchResult = {
  card_info?: {
    name?: string;
    set_name?: string;
    set_code?: string;
    card_number?: string;
  };
  tcgplayer?: {
    prices?:
      | InternationalPrices
      | InternationalPrices[];
  };
  cardmarket?: {
    prices?:
      | InternationalPrices
      | InternationalPrices[];
  };
};

type InternationalPrices = {
  market_price?: number;
  mid_price?: number;
  low_price?: number;
  trend?: number;
  avg?: number;
  low?: number;
};

type PokeWalletSearchResponse = {
  results?: PokeWalletSearchResult[];
};

type CacheEntry = {
  expiresAt: number;
  value: CardPrice;
};

const cache = new Map<string, CacheEntry>();
const ttlMs = 6 * 60 * 60 * 1000;

const api = axios.create({
  baseURL: env.pokeWalletApiUrl,
  timeout: 8000,
  headers: env.pokeWalletApiKey ? { "X-API-Key": env.pokeWalletApiKey } : undefined
});

const classMultipliers: Record<CardClass, number> = {
  COMMON: 1.3,
  UNCOMMON: 1.3,
  RARE: 1.4,
  DOUBLE_RARE: 1.5,
  ULTRA_RARE: 1.6,
  ILLUSTRATION_RARE: 1.7,
  SPECIAL_ILLUSTRATION_RARE: 1.8,
  HYPER_RARE: 1.8,
  PROMO: 1.6,
  SECRET_RARE: 1.8
};

const variantMultipliers: Record<PriceVariantType, number> = {
  NORMAL: 1,
  FOIL: 1.25,
  REVERSE_FOIL: 1.18,
  HOLO: 1.28,
  FULL_ART: 1.55,
  ALTERNATE_ART: 2,
  SECRET_RARE: 1.9,
  PROMO: 1.45,
  ILLUSTRATION_RARE: 1.65,
  SPECIAL_ILLUSTRATION_RARE: 2.05,
  HYPER_RARE: 1.95,
  ULTRA_RARE: 1.6
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeKey(value: string): string {
  return normalize(value).replace(/\s+/g, "_").toUpperCase();
}

function numberOnly(value?: string): string {
  return (value ?? "").split("/")[0]?.replace(/^0+(\d)/, "$1").trim() ?? "";
}

function roundMoney(value: number): number {
  return Math.max(0, Math.round(value * 100) / 100);
}

function stableHash(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 100000;
  }
  return hash;
}

function normalizeVariant(value?: string): PriceVariantType {
  const key = normalizeKey(value ?? "NORMAL");
  if (key === "REVERSE" || key === "REVERSE_HOLO") return "REVERSE_FOIL";
  if (key === "SIR") return "SPECIAL_ILLUSTRATION_RARE";
  if (key === "IR") return "ILLUSTRATION_RARE";
  if (key in variantMultipliers) return key as PriceVariantType;
  return "NORMAL";
}

function normalizeClass(value?: string, rarity?: string, variant?: PriceVariantType): CardClass {
  const key = normalizeKey(value ?? rarity ?? "");
  if (key.includes("SPECIAL") && key.includes("ILLUSTRATION")) return "SPECIAL_ILLUSTRATION_RARE";
  if (key.includes("ILLUSTRATION")) return "ILLUSTRATION_RARE";
  if (key.includes("HYPER")) return "HYPER_RARE";
  if (key.includes("SECRET")) return "SECRET_RARE";
  if (key.includes("ULTRA")) return "ULTRA_RARE";
  if (key.includes("DOUBLE")) return "DOUBLE_RARE";
  if (key.includes("PROMO")) return "PROMO";
  if (key.includes("UNCOMMON")) return "UNCOMMON";
  if (key.includes("COMMON")) return "COMMON";
  if (key.includes("RARE")) return "RARE";
  if (variant === "SPECIAL_ILLUSTRATION_RARE") return "SPECIAL_ILLUSTRATION_RARE";
  if (variant === "ILLUSTRATION_RARE") return "ILLUSTRATION_RARE";
  if (variant === "HYPER_RARE") return "HYPER_RARE";
  if (variant === "SECRET_RARE") return "SECRET_RARE";
  if (variant === "ULTRA_RARE" || variant === "FULL_ART" || variant === "ALTERNATE_ART") return "ULTRA_RARE";
  if (variant === "PROMO") return "PROMO";
  return "RARE";
}

function firstPrice(prices: undefined | InternationalPrices | InternationalPrices[]): number | null {
  const candidate = Array.isArray(prices) ? prices[0] : prices;
  if (!candidate) return null;
  return candidate.market_price ?? candidate.trend ?? candidate.avg ?? candidate.mid_price ?? candidate.low_price ?? candidate.low ?? null;
}

function resultScore(result: PokeWalletSearchResult, input: PriceLookupInput): number {
  const info = result.card_info;
  let score = 0;
  const inputName = normalize(input.cardName);
  const resultName = normalize(info?.name ?? "");
  if (resultName === inputName) score += 8;
  if (resultName.includes(inputName) || inputName.includes(resultName)) score += 3;
  if (normalize(info?.set_name ?? "") === normalize(input.collectionName)) score += 6;
  if (normalize(info?.set_code ?? "") === normalize(input.setCode ?? "")) score += 4;
  if (numberOnly(info?.card_number) === numberOnly(input.cardNumber)) score += 7;
  return score;
}

function buildCacheKey(input: PriceLookupInput): string {
  return [
    input.cardName,
    input.collectionName,
    input.setCode ?? "",
    numberOnly(input.cardNumber),
    input.language ?? "UNKNOWN",
    normalizeVariant(input.variantType),
    normalizeClass(input.cardClass, input.rarity, normalizeVariant(input.variantType)),
    normalize(input.condition ?? "near mint")
  ].join("|");
}

function buildPrice(input: PriceLookupInput, partial: Omit<CardPrice, "cardName" | "collectionName" | "setCode" | "cardNumber" | "variantType" | "cardClass" | "updatedAt">): CardPrice {
  const variantType = normalizeVariant(input.variantType);
  const cardClass = normalizeClass(input.cardClass, input.rarity, variantType);
  const estimatedPrice = roundMoney(partial.estimatedPrice);
  return {
    cardName: input.cardName,
    collectionName: input.collectionName,
    setCode: input.setCode ?? "",
    cardNumber: input.cardNumber ?? "",
    variantType,
    cardClass,
    minPrice: roundMoney(partial.minPrice),
    avgPrice: roundMoney(partial.avgPrice),
    maxPrice: roundMoney(partial.maxPrice),
    estimatedPrice,
    source: partial.source,
    confidence: partial.confidence,
    status: partial.status,
    updatedAt: new Date(),
    message: partial.message
  };
}

function weightedAverage(listings: MarketListing[]): number {
  const sorted = [...listings].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const totalWeight = sorted.reduce((sum, _item, index) => sum + 1 / (index + 1), 0);
  const weighted = sorted.reduce((sum, item, index) => sum + item.price * (1 / (index + 1)), 0);
  return weighted / totalWeight;
}

function priceFromListings(input: PriceLookupInput, listings: MarketListing[]): CardPrice | null {
  if (!listings.length) return null;
  const prices = listings.map((listing) => listing.price);
  const avg = weightedAverage(listings);
  return buildPrice(input, {
    minPrice: Math.min(...prices),
    avgPrice: avg,
    maxPrice: Math.max(...prices),
    estimatedPrice: avg,
    source: "INTERNAL_MARKETPLACE",
    confidence: listings.length >= 3 ? "HIGH" : "MEDIUM",
    status: "CONFIRMED"
  });
}

function simulatedMarketplaceListings(input: PriceLookupInput): MarketListing[] {
  const manual = input.manualValue ?? input.fallback ?? null;
  const variant = normalizeVariant(input.variantType);
  const cardClass = normalizeClass(input.cardClass, input.rarity, variant);
  const isBrazilian = input.language === "PT_BR" || normalize(input.collectionName).includes("brasil");
  if (!manual || manual <= 0 || !isBrazilian) return [];

  const base = manual * variantMultipliers[variant] * (classMultipliers[cardClass] / 1.4);
  const signature = buildCacheKey(input);
  const drift = (stableHash(signature) % 11) / 100;
  return [0.9 + drift, 1, 1.12 + drift].map((factor, index) => ({
    cardId: input.cardId ?? signature,
    storeId: `liga-sim-${index + 1}`,
    price: roundMoney(base * factor),
    condition: input.condition ?? "NM",
    createdAt: new Date(Date.now() - index * 24 * 60 * 60 * 1000)
  }));
}

function brazilReference(input: PriceLookupInput): CardPrice | null {
  const manual = input.manualValue ?? input.fallback ?? null;
  if (!manual || manual <= 0) return null;

  const variant = normalizeVariant(input.variantType);
  const cardClass = normalizeClass(input.cardClass, input.rarity, variant);
  const reference = manual * variantMultipliers[variant] * classMultipliers[cardClass] * 0.72;
  return buildPrice(input, {
    minPrice: reference * 0.92,
    avgPrice: reference,
    maxPrice: reference * 1.18,
    estimatedPrice: reference,
    source: "BRAZIL_REFERENCE",
    confidence: "MEDIUM",
    status: "ESTIMATED"
  });
}

function internalHistory(input: PriceLookupInput): CardPrice | null {
  const fallback = input.fallback ?? null;
  if (!fallback || fallback <= 0) return null;
  return buildPrice(input, {
    minPrice: fallback * 0.9,
    avgPrice: fallback,
    maxPrice: fallback * 1.15,
    estimatedPrice: fallback,
    source: "INTERNAL_HISTORY",
    confidence: "MEDIUM",
    status: "ESTIMATED"
  });
}

async function internationalPrice(input: PriceLookupInput): Promise<CardPrice | null> {
  if (!env.pokeWalletApiKey) return null;

  const response = await api.get<PokeWalletSearchResponse>("/search", {
    params: {
      q: [input.cardName, input.collectionName, input.setCode, input.cardNumber].filter(Boolean).join(" "),
      page: 1,
      limit: 10
    }
  });
  const results = response.data.results ?? [];
  const best = results.sort((a, b) => resultScore(b, input) - resultScore(a, input))[0];
  const usd = firstPrice(best?.tcgplayer?.prices) ?? firstPrice(best?.cardmarket?.prices);
  if (!usd || usd <= 0) return null;

  const variant = normalizeVariant(input.variantType);
  const cardClass = normalizeClass(input.cardClass, input.rarity, variant);
  const brl = usd * env.usdBrlRate * classMultipliers[cardClass] * variantMultipliers[variant];
  return buildPrice(input, {
    minPrice: brl * 0.88,
    avgPrice: brl,
    maxPrice: brl * 1.22,
    estimatedPrice: brl,
    source: "INTERNATIONAL_API",
    confidence: resultScore(best, input) >= 12 ? "MEDIUM" : "LOW",
    status: "ESTIMATED"
  });
}

function metadataEstimate(input: PriceLookupInput): CardPrice {
  const variant = normalizeVariant(input.variantType);
  const cardClass = normalizeClass(input.cardClass, input.rarity, variant);
  const baseByClass: Record<CardClass, number> = {
    COMMON: 1.5,
    UNCOMMON: 2.5,
    RARE: 5,
    DOUBLE_RARE: 12,
    ULTRA_RARE: 25,
    ILLUSTRATION_RARE: 35,
    SPECIAL_ILLUSTRATION_RARE: 75,
    HYPER_RARE: 55,
    PROMO: 18,
    SECRET_RARE: 65
  };
  const signature = buildCacheKey(input);
  const variance = 0.85 + (stableHash(signature) % 35) / 100;
  const estimate = baseByClass[cardClass] * variantMultipliers[variant] * variance;
  return buildPrice(input, {
    minPrice: estimate * 0.75,
    avgPrice: estimate,
    maxPrice: estimate * 1.35,
    estimatedPrice: estimate,
    source: "ESTIMATE",
    confidence: "LOW",
    status: "PRICE_PENDING",
    message: "Preco ainda nao confirmado no mercado brasileiro"
  });
}

function manualPrice(input: PriceLookupInput): CardPrice | null {
  const manual = input.manualValue ?? null;
  if (!manual || manual <= 0) return null;
  return buildPrice(input, {
    minPrice: manual,
    avgPrice: manual,
    maxPrice: manual,
    estimatedPrice: manual,
    source: "MANUAL_VALUE",
    confidence: "LOW",
    status: "MANUAL"
  });
}

export const priceService = {
  async getCardPrice(input: PriceLookupInput): Promise<CardPrice> {
    const cacheKey = buildCacheKey(input);
    const cached = cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) return cached.value;

    const marketplace = priceFromListings(input, simulatedMarketplaceListings(input));
    if (marketplace) {
      cache.set(cacheKey, { value: marketplace, expiresAt: Date.now() + ttlMs });
      return marketplace;
    }

    const nationalReference = brazilReference(input);
    if (nationalReference) {
      cache.set(cacheKey, { value: nationalReference, expiresAt: Date.now() + ttlMs });
      return nationalReference;
    }

    const history = internalHistory(input);
    if (history) {
      cache.set(cacheKey, { value: history, expiresAt: Date.now() + ttlMs });
      return history;
    }

    try {
      const international = await internationalPrice(input);
      if (international) {
        cache.set(cacheKey, { value: international, expiresAt: Date.now() + ttlMs });
        return international;
      }
    } catch (error) {
      console.warn(JSON.stringify({ level: "warn", message: "International price lookup failed", error: String(error) }));
    }

    const estimate = metadataEstimate(input);
    const manual = manualPrice(input);
    const result = estimate.estimatedPrice > 0 ? estimate : manual ?? estimate;
    cache.set(cacheKey, { value: result, expiresAt: Date.now() + 30 * 60 * 1000 });
    return result;
  },

  async estimate(input: { name: string; set: string; number?: string; fallback?: number | null; variantType?: string; rarity?: string; cardClass?: string }): Promise<number> {
    const price = await this.getCardPrice({
      cardName: input.name,
      collectionName: input.set,
      cardNumber: input.number,
      variantType: input.variantType ?? "NORMAL",
      rarity: input.rarity,
      cardClass: input.cardClass,
      fallback: input.fallback,
      manualValue: input.fallback
    });
    return price.estimatedPrice;
  }
};
