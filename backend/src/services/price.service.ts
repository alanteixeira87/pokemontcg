import axios from "axios";
import { env } from "../utils/env.js";

type PokeWalletSearchResult = {
  card_info?: {
    name?: string;
    set_name?: string;
    set_code?: string;
    card_number?: string;
  };
  tcgplayer?: {
    prices?:
      | {
          market_price?: number;
          mid_price?: number;
          low_price?: number;
        }
      | Array<{
          market_price?: number;
          mid_price?: number;
          low_price?: number;
        }>;
  };
  cardmarket?: {
    prices?:
      | {
          trend?: number;
          avg?: number;
          low?: number;
        }
      | Array<{
          trend?: number;
          avg?: number;
          low?: number;
        }>;
  };
};

type PokeWalletSearchResponse = {
  results?: PokeWalletSearchResult[];
};

type CacheEntry = {
  expiresAt: number;
  value: number | null;
};

const cache = new Map<string, CacheEntry>();
const ttlMs = 6 * 60 * 60 * 1000;

const api = axios.create({
  baseURL: env.pokeWalletApiUrl,
  timeout: 8000,
  headers: env.pokeWalletApiKey ? { "X-API-Key": env.pokeWalletApiKey } : undefined
});

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function numberOnly(value?: string): string {
  return (value ?? "").split("/")[0]?.replace(/^0+(\d)/, "$1").trim() ?? "";
}

function firstPrice(
  prices:
    | undefined
    | {
        market_price?: number;
        mid_price?: number;
        low_price?: number;
        trend?: number;
        avg?: number;
        low?: number;
      }
    | Array<{
        market_price?: number;
        mid_price?: number;
        low_price?: number;
        trend?: number;
        avg?: number;
        low?: number;
      }>
): number | null {
  const candidate = Array.isArray(prices) ? prices[0] : prices;
  if (!candidate) return null;
  return candidate.market_price ?? candidate.trend ?? candidate.avg ?? candidate.mid_price ?? candidate.low_price ?? candidate.low ?? null;
}

function resultScore(result: PokeWalletSearchResult, input: { name: string; set: string; number?: string }): number {
  const info = result.card_info;
  let score = 0;
  if (normalize(info?.name ?? "").includes(normalize(input.name))) score += 4;
  if (normalize(input.name).includes(normalize(info?.name ?? ""))) score += 2;
  if (normalize(info?.set_name ?? "") === normalize(input.set)) score += 5;
  if (numberOnly(info?.card_number) === numberOnly(input.number)) score += 5;
  return score;
}

export const priceService = {
  async estimate(input: { name: string; set: string; number?: string; fallback?: number | null }): Promise<number> {
    const fallback = input.fallback ?? 0;
    if (!env.pokeWalletApiKey) return fallback;

    const cacheKey = `${input.name}|${input.set}|${input.number ?? ""}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.value ?? fallback;
    }

    try {
      const q = [input.name, input.set, input.number].filter(Boolean).join(" ");
      const response = await api.get<PokeWalletSearchResponse>("/search", {
        params: { q, page: 1, limit: 10 }
      });
      const results = response.data.results ?? [];
      const best = results.sort((a, b) => resultScore(b, input) - resultScore(a, input))[0];
      const price = firstPrice(best?.tcgplayer?.prices) ?? firstPrice(best?.cardmarket?.prices);
      cache.set(cacheKey, { value: price, expiresAt: Date.now() + ttlMs });
      return price ?? fallback;
    } catch (error) {
      console.warn(JSON.stringify({ level: "warn", message: "PokeWallet price lookup failed", error: String(error) }));
      cache.set(cacheKey, { value: null, expiresAt: Date.now() + 15 * 60 * 1000 });
      return fallback;
    }
  }
};
