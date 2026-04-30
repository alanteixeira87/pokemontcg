import axios from "axios";
import { env } from "../utils/env.js";
import { normalizeCard } from "../utils/normalize.js";
import type { PaginatedCards, PokemonCard, PokemonSet } from "../types.js";

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const cache = new Map<string, CacheEntry<unknown>>();
const ttlMs = 60 * 60 * 1000;

const api = axios.create({
  baseURL: env.pokemonApiUrl,
  timeout: 10000,
  headers: env.pokemonApiKey ? { "X-Api-Key": env.pokemonApiKey } : undefined
});

function getCached<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit || Date.now() > hit.expiresAt) {
    cache.delete(key);
    return null;
  }
  return hit.value as T;
}

function setCached<T>(key: string, value: T): T {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

async function withRetry<T>(request: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await request();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 350));
      }
    }
  }
  throw lastError;
}

function buildCardQuery(search?: string, set?: string): string | undefined {
  const terms: string[] = [];
  const cleanSearch = sanitizeSearch(search);
  if (cleanSearch) {
    terms.push(
      ...cleanSearch
        .split(" ")
        .filter(Boolean)
        .map((term) => `name:*${term}*`)
    );
  }
  if (set) {
    terms.push(`set.id:"${escapeQuery(set)}"`);
  }
  return terms.length ? terms.join(" ") : undefined;
}

function escapeQuery(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"').trim();
}

function sanitizeSearch(value?: string): string {
  return escapeQuery(value ?? "")
    .replace(/[^\p{L}\p{N}\s.'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const pokemonService = {
  async listCards(page: number, pageSize: number, search?: string, set?: string): Promise<PaginatedCards> {
    const cacheKey = `cards:${page}:${pageSize}:${search ?? ""}:${set ?? ""}`;
    const cached = getCached<PaginatedCards>(cacheKey);
    if (cached) return cached;

    const q = buildCardQuery(search, set);
    const response = await withRetry(() =>
      api.get<{ data: PokemonCard[]; totalCount: number }>("/cards", {
        params: { page, pageSize, q }
      })
    );

    return setCached(cacheKey, {
      cards: response.data.data.map(normalizeCard),
      page,
      pageSize,
      totalCount: response.data.totalCount
    });
  },

  async listSets(): Promise<PokemonSet[]> {
    const cached = getCached<PokemonSet[]>("sets");
    if (cached) return cached;

    const response = await withRetry(() =>
      api.get<{ data: PokemonSet[] }>("/sets", {
        params: { orderBy: "-releaseDate" }
      })
    );

    return setCached(
      "sets",
      response.data.data.map((set) => ({
        id: set.id,
        name: set.name,
        series: set.series
      }))
    );
  },

  async findCardBySetAndNumber(setName: string, number: string) {
    const normalizedSet = escapeQuery(setName);
    const normalizedNumber = escapeQuery(number);
    const cacheKey = `card-by-set-number:${normalizedSet}:${normalizedNumber}`;
    const cached = getCached<ReturnType<typeof normalizeCard> | null>(cacheKey);
    if (cached) return cached;

    const response = await withRetry(() =>
      api.get<{ data: PokemonCard[] }>("/cards", {
        params: {
          page: 1,
          pageSize: 5,
          q: `set.name:"${normalizedSet}" number:"${normalizedNumber}"`
        }
      })
    );

    const exact = response.data.data.find(
      (card) =>
        card.number?.toLowerCase() === number.toLowerCase() &&
        card.set?.name?.toLowerCase() === setName.toLowerCase()
    );
    const card = exact ?? response.data.data[0];
    return setCached(cacheKey, card ? normalizeCard(card) : null);
  }
};
