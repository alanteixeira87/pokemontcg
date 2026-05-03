import axios from "axios";
import { env } from "../utils/env.js";
import { normalizeCard } from "../utils/normalize.js";
import type { ExploreCard, PaginatedCards, PokemonCard, PokemonSet } from "../types.js";
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

const tcgDexApi = axios.create({
  baseURL: "https://api.tcgdex.net/v2/en",
  timeout: 10000
});

type TcgDexSet = {
  id: string;
  name: string;
  cardCount?: {
    total?: number;
    official?: number;
  };
};

type TcgDexCardBrief = {
  id: string;
  localId?: string;
  name: string;
  image?: string;
};

type TcgDexSetDetail = TcgDexSet & {
  cards?: TcgDexCardBrief[];
};

type TcgDexCardDetail = TcgDexCardBrief & {
  rarity?: string;
  set?: {
    id?: string;
    name?: string;
  };
  pricing?: {
    cardmarket?: {
      avg?: number;
      trend?: number;
      low?: number;
      avg1?: number;
      avg7?: number;
      avg30?: number;
    };
  };
};

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

function equivalentSetIds(id: string): string[] {
  const normalized = id.trim().toLowerCase();
  const scarletVioletShort = normalized.replace(/^sv0(\d)(.*)$/, "sv$1$2");
  const scarletVioletLong = normalized.replace(/^sv(\d)(.*)$/, "sv0$1$2");
  const ptToDot = normalized.replace(/pt(\d+)$/, ".$1");
  const dotToPt = normalized.replace(/\.(\d+)$/, "pt$1");
  const ptShort = scarletVioletShort.replace(/pt(\d+)$/, ".$1");
  const dotLong = ptToDot.replace(/^sv(\d)(\..*)$/, "sv0$1$2");
  const dotShort = ptToDot.replace(/^sv0(\d)(\..*)$/, "sv$1$2");
  const ptLong = dotToPt.replace(/^sv(\d)(pt.*)$/, "sv0$1$2");

  return Array.from(new Set([normalized, scarletVioletShort, scarletVioletLong, ptToDot, dotToPt, ptShort, dotLong, dotShort, ptLong].filter(Boolean)));
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

function tcgDexImage(image?: string): string {
  return image ? `${image}/high.png` : "https://images.pokemontcg.io/base1/4.png";
}

function tcgDexPrice(card: TcgDexCardDetail): number | null {
  const prices = card.pricing?.cardmarket;
  const value = prices?.avg ?? prices?.trend ?? prices?.avg7 ?? prices?.avg30 ?? prices?.avg1 ?? prices?.low;
  if (!value || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * env.eurBrlRate * 100) / 100;
}

function normalizeTcgDexCard(card: TcgDexCardDetail | TcgDexCardBrief, set: TcgDexSet): ExploreCard {
  const detail = card as TcgDexCardDetail;
  return {
    id: card.id,
    name: card.name,
    image: tcgDexImage(card.image),
    set: detail.set?.name ?? set.name,
    setId: detail.set?.id ?? set.id,
    number: card.localId,
    rarity: detail.rarity,
    marketPrice: tcgDexPrice(detail)
  };
}

function tcgDexSetIdFromCardId(id: string): string {
  return id.includes("-") ? id.slice(0, id.lastIndexOf("-")) : id;
}

function resolveSearchSetIds(search: string | undefined, sets: PokemonSet[]): Set<string> {
  const normalizedSearch = normalizeLookupText(search ?? "");
  if (!normalizedSearch) return new Set();

  const compactSearch = compactCode(search ?? "");
  const searchIdCandidates = equivalentSetIds(compactSearch);
  const aliasId = setAliases.get(normalizedSearch) ?? setAliases.get(compactSearch);
  const aliasIds = aliasId ? equivalentSetIds(aliasId) : [];

  const matches = sets.filter((set) => {
    const setName = normalizeLookupText(set.name);
    const setIds = equivalentSetIds(set.id);
    const candidates = [...setCodeCandidates(set), ...setIds];

    return (
      setName === normalizedSearch ||
      candidates.includes(compactSearch) ||
      searchIdCandidates.some((id) => setIds.includes(id)) ||
      aliasIds.some((id) => setIds.includes(id))
    );
  });

  return new Set(matches.flatMap((set) => equivalentSetIds(set.id)));
}

async function listTcgDexCards(): Promise<TcgDexCardBrief[]> {
  const cached = getCached<TcgDexCardBrief[]>("tcgdex:cards");
  if (cached) return cached;

  const response = await withRetry(() => tcgDexApi.get<TcgDexCardBrief[]>("/cards"));
  return setCached("tcgdex:cards", response.data);
}

async function enrichTcgDexCard(card: TcgDexCardBrief, set: TcgDexSet): Promise<ExploreCard> {
  try {
    const detail = await withRetry(() => tcgDexApi.get<TcgDexCardDetail>(`/cards/${card.id}`), 1);
    return normalizeTcgDexCard(detail.data, set);
  } catch {
    return normalizeTcgDexCard(card, set);
  }
}

async function getTcgDexSetDetail(setId: string): Promise<TcgDexSetDetail> {
  const cacheKey = `tcgdex:set:${setId}`;
  const cached = getCached<TcgDexSetDetail>(cacheKey);
  if (cached) return cached;

  const response = await withRetry(() => tcgDexApi.get<TcgDexSetDetail>(`/sets/${setId}`));
  return setCached(cacheKey, response.data);
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
  ["asc", "me02.5"],
  ["blk", "sv10.5b"],
  ["dri", "sv10"],
  ["jtg", "sv09"],
  ["lor", "swsh11"],
  ["m23", "2023sv"],
  ["meg", "me01"],
  ["mep", "mep"],
  ["mew", "sv03.5"],
  ["obf", "sv03"],
  ["paf", "sv04.5"],
  ["pal", "sv02"],
  ["par", "sv04"],
  ["pfl", "me02"],
  ["por", "me03"],
  ["pre", "sv08.5"],
  ["scr", "sv07"],
  ["src", "sv07"],
  ["ssp", "sv08"],
  ["svi", "sv01"],
  ["svp", "svp"],
  ["tef", "sv05"],
  ["twm", "sv06"],
  ["umb", "svp"],
  ["wht", "sv10.5w"],
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

async function listTcgDexSets(): Promise<PokemonSet[]> {
  const cached = getCached<PokemonSet[]>("tcgdex:sets");
  if (cached) return cached;

  const response = await withRetry(() => tcgDexApi.get<TcgDexSet[]>("/sets"));
  return setCached(
    "tcgdex:sets",
    response.data.map((set) => ({
      id: set.id,
      name: set.name,
      printedTotal: set.cardCount?.official,
      total: set.cardCount?.total
    }))
  );
}

async function listCardsFromTcgDex(page: number, pageSize: number, search?: string, set?: string, sort: "numberAsc" | "numberDesc" | "name" = "numberAsc"): Promise<PaginatedCards> {
  const [cards, sets] = await Promise.all([listTcgDexCards(), listTcgDexSets()]);
  const setById = new Map(sets.map((item) => [item.id, item]));
  const cleanSearch = normalizeLookupText(search ?? "");
  const searchSetIds = resolveSearchSetIds(search, sets);

  const filtered = cards.filter((card) => {
    const setId = tcgDexSetIdFromCardId(card.id);
    const matchesSet = set ? equivalentSetIds(setId).includes(set.toLowerCase()) || equivalentSetIds(set).includes(setId) : true;
    const matchesSearch = cleanSearch
      ? searchSetIds.size > 0
        ? equivalentSetIds(setId).some((id) => searchSetIds.has(id))
        : normalizeLookupText(card.name).includes(cleanSearch)
      : true;
    return matchesSet && matchesSearch;
  });

  const mapped = filtered.map((card) => {
    const setId = tcgDexSetIdFromCardId(card.id);
    return normalizeTcgDexCard(card, setById.get(setId) ?? { id: setId, name: setId });
  });
  const sorted = sortCards(mapped, sort);
  const pageCards = sorted.slice((page - 1) * pageSize, page * pageSize);
  const enriched = await Promise.all(
    pageCards.map((card) => enrichTcgDexCard({ id: card.id, localId: card.number, name: card.name, image: card.image?.replace(/\/high\.png$/, "") }, setById.get(card.setId ?? "") ?? { id: card.setId ?? "", name: card.set }))
  );

  return {
    cards: enriched,
    page,
    pageSize,
    totalCount: filtered.length
  };
}

async function resolveTcgDexSetCandidates(input: string, setTotal?: string): Promise<PokemonSet[]> {
  const sets = await listTcgDexSets();
  const normalizedInput = normalizeLookupText(input);
  const compactInput = compactCode(input);
  const totalNumber = Number(setTotal);
  const aliasId = setAliases.get(normalizedInput);
  const aliasIds = aliasId ? equivalentSetIds(aliasId) : [];

  const exact = sets.filter((set) => {
    const setIds = equivalentSetIds(set.id);
    return (
      setIds.includes(input.trim().toLowerCase()) ||
      normalizeLookupText(set.name) === normalizedInput ||
      setCodeCandidates(set).includes(compactInput) ||
      aliasIds.some((id) => setIds.includes(id))
    );
  });

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

async function findCardBySetAndNumberFromPokemon(setName: string, number: string, setTotal?: string): Promise<ExploreCard | null> {
  const normalizedSet = escapeQuery(setName);
  const numberCandidates = normalizeCardNumbers(number);
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
      if (card) return normalizeCardWithPrice(card);
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
    if (card) return normalizeCardWithPrice(card);
  }

  return null;
}

async function findCardBySetAndNumberFromTcgDex(setName: string, number: string, setTotal?: string): Promise<ExploreCard | null> {
  const numberCandidates = normalizeCardNumbers(number).map((candidate) => normalizeLookupText(candidate));
  const setCandidates = await resolveTcgDexSetCandidates(setName, setTotal);

  for (const set of setCandidates) {
    const setDetail = await getTcgDexSetDetail(set.id);
    const cards = setDetail.cards ?? [];
    const card = cards.find((item) =>
      normalizeCardNumbers(item.localId ?? "").some((candidate) => numberCandidates.includes(normalizeLookupText(candidate)))
    );

    if (card) return normalizeTcgDexCard(card, setDetail);
  }

  return null;
}

export const pokemonService = {
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

    return setCached(cacheKey, await listCardsFromTcgDex(page, pageSize, search, set, sort));
  },

  async listSets(): Promise<PokemonSet[]> {
    const cached = getCached<PokemonSet[]>("sets");
    if (cached) return cached;

    return setCached("sets", await listTcgDexSets());
  },

  async findCardsBySetAndNumbers(setName: string, numbers: string[]): Promise<Map<string, ExploreCard>> {
    const result = new Map<string, ExploreCard>();
    const uniqueNumbers = Array.from(new Set(numbers.map((number) => normalizeCardNumbers(number)[0]).filter(Boolean)));
    const requested = new Map(uniqueNumbers.map((number) => [number, normalizeCardNumbers(number).map(normalizeLookupText)]));

    try {
      const setCandidates = await resolveTcgDexSetCandidates(setName);

      for (const set of setCandidates) {
        const setDetail = await getTcgDexSetDetail(set.id);
        const cards = setDetail.cards ?? [];

        for (const card of cards) {
          const cardNumbers = normalizeCardNumbers(card.localId ?? "").map(normalizeLookupText);
          for (const [requestedNumber, requestedCandidates] of requested.entries()) {
            if (result.has(requestedNumber)) continue;
            if (cardNumbers.some((candidate) => requestedCandidates.includes(candidate))) {
              const normalized = normalizeTcgDexCard(card, setDetail);
              result.set(requestedNumber, normalized);
              const cacheKey = `card-by-set-number:${escapeQuery(setName)}::${normalizeCardNumbers(requestedNumber).join("|")}`;
              setCached(cacheKey, normalized);
            }
          }
        }

        if (result.size === uniqueNumbers.length) return result;
      }
    } catch (error) {
      console.warn(JSON.stringify({ level: "warn", message: "Batch TCGdex validation failed", setName, error: String(error) }));
    }

    for (const number of uniqueNumbers) {
      if (result.has(number)) continue;
      const fallback = await this.findCardBySetAndNumber(setName, number);
      if (fallback) result.set(number, fallback);
    }

    return result;
  },

  async findCardBySetAndNumber(setName: string, number: string, setTotal?: string) {
    const normalizedSet = escapeQuery(setName);
    const numberCandidates = normalizeCardNumbers(number);
    const cacheKey = `card-by-set-number:${normalizedSet}:${setTotal ?? ""}:${numberCandidates.join("|")}`;
    const cached = getCached<ReturnType<typeof normalizeCard> | null>(cacheKey);
    if (cached) return cached;

    try {
      const primaryCard = await findCardBySetAndNumberFromTcgDex(setName, number, setTotal);
      if (primaryCard) return setCached(cacheKey, primaryCard);
    } catch (error) {
      console.warn(
        JSON.stringify({
          level: "warn",
          message: "Primary TCGdex card validation failed, trying Pokemon API",
          setName,
          number,
          error: String(error)
        })
      );
    }

    try {
      const secondaryCard = await findCardBySetAndNumberFromPokemon(setName, number, setTotal);
      if (secondaryCard) {
        console.info(
          JSON.stringify({
            level: "info",
            message: "Card validated using Pokemon API fallback",
            setName,
            number,
            cardId: secondaryCard.id
          })
        );
        return setCached(cacheKey, secondaryCard);
      }
    } catch (error) {
      console.warn(
        JSON.stringify({
          level: "warn",
          message: "Secondary Pokemon API card validation failed",
          setName,
          number,
          error: String(error)
        })
      );
    }

    return setCached(cacheKey, null);
  }
};
