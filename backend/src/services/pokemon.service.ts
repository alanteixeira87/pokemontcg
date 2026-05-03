import axios from "axios";
import { env } from "../utils/env.js";
import { normalizeCard } from "../utils/normalize.js";
import type { PaginatedCards, PokemonCard, PokemonSet } from "../types.js";
import { priceService } from "./price.service.js";

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

function sortCards(cards: ReturnType<typeof normalizeCard>[], sort: "numberAsc" | "numberDesc" | "name") {
  const numericPart = (number?: string) => {
    const parsed = Number((number ?? "").match(/\d+/)?.[0] ?? Number.MAX_SAFE_INTEGER);
    return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
  };

  return [...cards].sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    const direction = sort === "numberDesc" ? -1 : 1;
    const numberDiff = numericPart(a.number) - numericPart(b.number);
    return numberDiff !== 0 ? numberDiff * direction : a.name.localeCompare(b.name);
  });
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

function normalizeLookupText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeCardNumbers(value: string): string[] {
  const raw = value.trim();
  const beforeSlash = raw.split("/")[0]?.trim() ?? raw;
  const withoutHash = beforeSlash.replace(/^#/, "").trim();
  const withoutLeadingZeros = withoutHash.replace(/^0+(\d)/, "$1");
  return Array.from(new Set([raw, beforeSlash, withoutHash, withoutLeadingZeros].filter(Boolean)));
}

function compactCode(value: string): string {
  return normalizeLookupText(value).replace(/\s+/g, "");
}

function setCodeCandidates(set: PokemonSet): string[] {
  const compactName = compactCode(set.name);
  const wordInitials = normalizeLookupText(set.name)
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0])
    .join("");

  return Array.from(
    new Set([set.id, set.ptcgoCode ?? "", compactName.slice(0, 3), wordInitials].map((value) => compactCode(value)).filter(Boolean))
  );
}

async function normalizeCardWithPrice(card: PokemonCard): Promise<ReturnType<typeof normalizeCard>> {
  const normalized = normalizeCard(card);
  if (normalized.marketPrice !== null) return normalized;

  const price = await priceService.getCardPrice({
    cardId: card.id,
    cardName: card.name,
    collectionName: card.set?.name ?? "Colecao desconhecida",
    setCode: card.set?.id,
    cardNumber: card.number,
    rarity: card.rarity,
    variantType: "NORMAL"
  });

  return {
    ...normalized,
    marketPrice: price.estimatedPrice
  };
}

const setAliases = new Map<string, string>([
  ["escarlate e violeta", "sv1"],
  ["scarlet violet", "sv1"],
  ["evoluidos em paldea", "sv2"],
  ["paldea evoluida", "sv2"],
  ["paldea evolved", "sv2"],
  ["chamas obsidianas", "sv3"],
  ["obsidian flames", "sv3"],
  ["151", "sv3pt5"],
  ["fenda paradoxal", "sv4"],
  ["paradox rift", "sv4"],
  ["destinos de paldea", "sv4pt5"],
  ["paldean fates", "sv4pt5"],
  ["forcas temporais", "sv5"],
  ["temporal forces", "sv5"],
  ["mascara do crepusculo", "sv6"],
  ["twilight masquerade", "sv6"],
  ["fabula nebulosa", "sv6pt5"],
  ["shrouded fable", "sv6pt5"],
  ["coroa estelar", "sv7"],
  ["stellar crown", "sv7"],
  ["fagulhas impetuosas", "sv8"],
  ["surging sparks", "sv8"],
  ["evolucoes prismaticas", "sv8pt5"],
  ["prismatic evolutions", "sv8pt5"],
  ["jornada juntos", "sv9"],
  ["journey together", "sv9"],
  ["rivais destinados", "sv10"],
  ["destined rivals", "sv10"]
]);

async function resolveSetCandidates(input: string, setTotal?: string): Promise<PokemonSet[]> {
  const sets = await pokemonService.listSets();
  const normalizedInput = normalizeLookupText(input);
  const compactInput = compactCode(input);
  const totalNumber = Number(setTotal);
  const aliasId = setAliases.get(normalizedInput);

  const exact = sets.filter(
    (set) =>
      set.id.toLowerCase() === input.trim().toLowerCase() ||
      set.ptcgoCode?.toLowerCase() === input.trim().toLowerCase() ||
      normalizeLookupText(set.name) === normalizedInput ||
      setCodeCandidates(set).includes(compactInput) ||
      (aliasId ? set.id === aliasId : false)
  );
  if (exact.length) {
    const exactWithTotal = Number.isFinite(totalNumber)
      ? exact.filter((set) => set.printedTotal === totalNumber || set.total === totalNumber)
      : exact;
    return exactWithTotal.length ? exactWithTotal : exact;
  }

  if (Number.isFinite(totalNumber)) {
    const byTotal = sets.filter((set) => set.printedTotal === totalNumber || set.total === totalNumber);
    if (byTotal.length) {
      const byCode = byTotal.filter((set) => setCodeCandidates(set).includes(compactInput));
      return byCode.length ? byCode : byTotal.slice(0, 5);
    }
  }

  return sets
    .filter((set) => {
      const setName = normalizeLookupText(set.name);
      return normalizedInput.length >= 3 && (setName.includes(normalizedInput) || normalizedInput.includes(setName));
    })
    .slice(0, 5);
}

export const pokemonService = {
  async resolveSetReference(setName: string, userTotal?: string): Promise<{ id: string; name: string; printedTotal?: number; total?: number; userTotal?: number; totalMatches: boolean } | null> {
    const candidates = await resolveSetCandidates(setName);
    const set = candidates[0] ?? null;
    if (!set) return null;

    const parsedUserTotal = Number(userTotal);
    const hasUserTotal = Number.isFinite(parsedUserTotal) && parsedUserTotal > 0;
    const totalMatches = hasUserTotal ? set.printedTotal === parsedUserTotal || set.total === parsedUserTotal : true;

    return {
      id: set.id,
      name: set.name,
      printedTotal: set.printedTotal,
      total: set.total,
      userTotal: hasUserTotal ? parsedUserTotal : undefined,
      totalMatches
    };
  },

  async findCardById(id: string): Promise<ReturnType<typeof normalizeCard> | null> {
    const cacheKey = `card:${id}`;
    const cached = getCached<ReturnType<typeof normalizeCard> | null>(cacheKey);
    if (cached) return cached;

    try {
      const response = await withRetry(() => api.get<{ data: PokemonCard }>(`/cards/${escapeQuery(id)}`));
      return setCached(cacheKey, await normalizeCardWithPrice(response.data.data));
    } catch {
      return setCached(cacheKey, null);
    }
  },

  async listCards(page: number, pageSize: number, search?: string, set?: string, sort: "numberAsc" | "numberDesc" | "name" = "numberAsc"): Promise<PaginatedCards> {
    const cacheKey = `cards:${page}:${pageSize}:${search ?? ""}:${set ?? ""}:${sort}`;
    const cached = getCached<PaginatedCards>(cacheKey);
    if (cached) return cached;

    const q = buildCardQuery(search, set);
    const response = await withRetry(() =>
      api.get<{ data: PokemonCard[]; totalCount: number }>("/cards", {
        params: { page, pageSize, q }
      })
    );

    return setCached(cacheKey, {
      cards: sortCards(await Promise.all(response.data.data.map(normalizeCardWithPrice)), sort),
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
        series: set.series,
        ptcgoCode: set.ptcgoCode,
        printedTotal: set.printedTotal,
        total: set.total
      }))
    );
  },

  async listCardsBySetId(setId: string): Promise<ReturnType<typeof normalizeCard>[]> {
    const cacheKey = `cards-by-set:${setId}`;
    const cached = getCached<ReturnType<typeof normalizeCard>[]>(cacheKey);
    if (cached) return cached;

    const first = await withRetry(() =>
      api.get<{ data: PokemonCard[]; totalCount: number }>("/cards", {
        params: {
          page: 1,
          pageSize: 250,
          q: `set.id:"${escapeQuery(setId)}"`
        }
      })
    );
    const cards = [...first.data.data];
    const totalPages = Math.ceil(first.data.totalCount / 250);

    for (let page = 2; page <= totalPages; page += 1) {
      const response = await withRetry(() =>
        api.get<{ data: PokemonCard[] }>("/cards", {
          params: {
            page,
            pageSize: 250,
            q: `set.id:"${escapeQuery(setId)}"`
          }
        })
      );
      cards.push(...response.data.data);
    }

    return setCached(cacheKey, sortCards(await Promise.all(cards.map(normalizeCardWithPrice)), "numberAsc"));
  },

  async findCardBySetAndNumber(setName: string, number: string, setTotal?: string) {
    const normalizedSet = escapeQuery(setName);
    const numberCandidates = normalizeCardNumbers(number);
    const cacheKey = `card-by-set-number:${normalizedSet}:${setTotal ?? ""}:${numberCandidates.join("|")}`;
    const cached = getCached<ReturnType<typeof normalizeCard> | null>(cacheKey);
    if (cached) return cached;

    const setCandidates = await resolveSetCandidates(setName, setTotal);

    for (const set of setCandidates) {
      for (const candidateNumber of numberCandidates) {
        const normalizedNumber = escapeQuery(candidateNumber);
        const response = await withRetry(() =>
          api.get<{ data: PokemonCard[] }>("/cards", {
            params: {
              page: 1,
              pageSize: 5,
              q: `set.id:"${escapeQuery(set.id)}" number:"${normalizedNumber}"`
            }
          })
        );

        const exact = response.data.data.find(
          (card) => normalizeLookupText(card.number ?? "") === normalizeLookupText(candidateNumber)
        );
        const card = exact ?? response.data.data[0];
        if (card) {
          return setCached(cacheKey, await normalizeCardWithPrice(card));
        }
      }
    }

    for (const candidateNumber of numberCandidates) {
      const normalizedNumber = escapeQuery(candidateNumber);
      const response = await withRetry(() =>
        api.get<{ data: PokemonCard[] }>("/cards", {
          params: {
            page: 1,
            pageSize: 5,
            q: `set.name:"${normalizedSet}" number:"${normalizedNumber}"`
          }
        })
      );

      const card = response.data.data[0];
      if (card) {
      return setCached(cacheKey, await normalizeCardWithPrice(card));
      }
    }

    return setCached(cacheKey, null);
  }
};
