import axios from "axios";
import type { Prisma } from "@prisma/client";
import { env } from "../utils/env.js";
import { normalizeCard } from "../utils/normalize.js";
import type { ExploreCard, PaginatedCards, PokemonCard, PokemonSet } from "../types.js";
import { priceService } from "./price.service.js";
import { prisma } from "../database/prisma.js";

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

type PokemonApiSet = PokemonSet & {
  releaseDate?: string;
  updatedAt?: string;
  images?: {
    symbol?: string;
    logo?: string;
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
      updated?: string;
      unit?: string;
      avg?: number;
      low?: number;
      trend?: number;
      avg1?: number;
      avg7?: number;
      avg30?: number;
      "avg-holo"?: number;
      "low-holo"?: number;
      "trend-holo"?: number;
      "avg1-holo"?: number;
      "avg7-holo"?: number;
      "avg30-holo"?: number;
    };
    tcgplayer?: {
      updated?: string;
      unit?: string;
      normal?: {
        lowPrice?: number;
        midPrice?: number;
        highPrice?: number;
        marketPrice?: number;
        directLowPrice?: number;
      };
      holo?: {
        lowPrice?: number;
        midPrice?: number;
        highPrice?: number;
        marketPrice?: number;
        directLowPrice?: number;
      };
      reverse?: {
        lowPrice?: number;
        midPrice?: number;
        highPrice?: number;
        marketPrice?: number;
        directLowPrice?: number;
      };
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

const specialEquivalentSetIds = new Map<string, string[]>([
  ["zsv10pt5", ["sv10.5b", "sv10pt5b"]],
  ["sv10.5b", ["zsv10pt5", "sv10pt5b"]],
  ["rsv10pt5", ["sv10.5w", "sv10pt5w"]],
  ["sv10.5w", ["rsv10pt5", "sv10pt5w"]],
  ["me1", ["me01"]],
  ["me01", ["me1"]],
  ["me2", ["me02"]],
  ["me02", ["me2"]],
  ["me2pt5", ["me02.5", "me02pt5"]],
  ["me02.5", ["me2pt5", "me02pt5"]],
  ["me3", ["me03"]],
  ["me03", ["me3"]],
  ["me4", ["me04"]],
  ["me04", ["me4"]]
]);

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
  const megaShort = normalized.replace(/^me0(\d)(.*)$/, "me$1$2");
  const megaLong = normalized.replace(/^me(\d)(.*)$/, "me0$1$2");
  const megaPtToDot = normalized.replace(/^me0?(\d)pt(\d+)$/, "me0$1.$2");
  const megaDotToPt = normalized.replace(/^me0?(\d)\.(\d+)$/, "me$1pt$2");
  const explicit = specialEquivalentSetIds.get(normalized) ?? [];

  return Array.from(
    new Set(
      [
        normalized,
        scarletVioletShort,
        scarletVioletLong,
        ptToDot,
        dotToPt,
        ptShort,
        dotLong,
        dotShort,
        ptLong,
        megaShort,
        megaLong,
        megaPtToDot,
        megaDotToPt,
        ...explicit
      ].filter(Boolean)
    )
  );
}

function setCodeCandidates(set: PokemonSet): string[] {
  const wordInitials = normalizeLookupText(set.name)
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0])
    .join("");

  return Array.from(
    new Set([set.id, set.ptcgoCode ?? "", wordInitials].map((value) => compactCode(value)).filter(Boolean))
  );
}

function tcgDexImage(image?: string): string {
  return image ? `${image}/high.png` : "https://images.pokemontcg.io/base1/4.png";
}

function tcgDexPrice(card: TcgDexCardDetail): number | null {
  try {
    // Prefer Cardmarket (EUR) pricing - usually more stable
    const cardmarket = card.pricing?.cardmarket;
    if (cardmarket) {
      // Try to get the best average price (prioritize 30-day average for stability)
      const eur = cardmarket.avg30 ?? cardmarket.avg7 ?? cardmarket.avg ?? cardmarket.trend ?? cardmarket["avg-holo"] ?? cardmarket.low;
      if (eur && Number.isFinite(eur) && eur > 0) {
        return Math.round(eur * env.eurBrlRate * 100) / 100;
      }
    }

    // Fallback to TCGplayer (USD) pricing
    const tcgplayer = card.pricing?.tcgplayer;
    if (tcgplayer) {
      // Try normal variant first, then reverse, then holo
      const usd = 
        tcgplayer.normal?.marketPrice ??
        tcgplayer.normal?.midPrice ??
        tcgplayer.reverse?.marketPrice ??
        tcgplayer.reverse?.midPrice ??
        tcgplayer.holo?.marketPrice ??
        tcgplayer.holo?.midPrice;
      if (usd && Number.isFinite(usd) && usd > 0) {
        return Math.round(usd * env.usdBrlRate * 100) / 100;
      }
    }

    return null;
  } catch (error) {
    console.warn(JSON.stringify({ level: "warn", message: "Error extracting TCGdex price", cardId: card.id, error: String(error) }));
    return null;
  }
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

async function listCardsFromPersistentCache(page: number, pageSize: number, search?: string, set?: string, sort: "numberAsc" | "numberDesc" | "name" = "numberAsc"): Promise<PaginatedCards | null> {
  const where: Prisma.CachedCardWhereInput = {
    setId: set || undefined,
    OR: search
      ? [
          { name: { contains: search, mode: "insensitive" } },
          { set: { contains: search, mode: "insensitive" } },
          { number: { contains: search, mode: "insensitive" } }
        ]
      : undefined
  };
  const totalCount = await prisma.cachedCard.count({ where });
  if (totalCount === 0) return null;

  const rows = await prisma.cachedCard.findMany({
    where,
    orderBy: sort === "name" ? { name: "asc" } : { name: "asc" },
    skip: (page - 1) * pageSize,
    take: pageSize
  });

  return {
    cards: sortCards(
      rows.map((card) => ({
        id: card.id,
        name: card.name,
        image: card.image,
        set: card.set,
        setId: card.setId ?? undefined,
        number: card.number ?? undefined,
        rarity: card.rarity ?? undefined,
        marketPrice: card.marketPrice
      })),
      sort
    ),
    page,
    pageSize,
    totalCount
  };
}

async function listPokemonCards(page: number, pageSize: number, search?: string, set?: string, sort: "numberAsc" | "numberDesc" | "name" = "numberAsc"): Promise<PaginatedCards> {
  const q = buildCardQuery(search, set);
  const response = await withRetry(
    () =>
      api.get<{ data: PokemonCard[]; totalCount?: number }>("/cards", {
        params: {
          page,
          pageSize,
          q,
          orderBy: sort === "numberDesc" ? "-number" : sort === "name" ? "name" : "number"
        }
      }),
    1
  );
  const cards = response.data.data.map(normalizeCard);
  void persistCachedCards(cards);
  return {
    cards,
    page,
    pageSize,
    totalCount: response.data.totalCount ?? cards.length
  };
}

async function listPokemonSets(): Promise<PokemonSet[]> {
  const response = await withRetry(() => api.get<{ data: PokemonApiSet[] }>("/sets"), 1);
  const sets = response.data.data.map((set, index) => ({
    id: set.id,
    name: set.name,
    series: set.series,
    ptcgoCode: set.ptcgoCode,
    printedTotal: set.printedTotal,
    total: set.total,
    logo: set.images?.logo,
    symbol: set.images?.symbol,
    releaseDate: set.releaseDate,
    sortOrder: index
  }));
  void persistCachedSets(sets);
  return sets;
}

async function listSetsFromPersistentCache(): Promise<PokemonSet[]> {
  const rows = await prisma.cachedSet.findMany({ orderBy: { updatedAt: "desc" } });
  return rows.map((set) => ({
    id: set.id,
    name: set.name,
    series: set.series ?? undefined,
    ptcgoCode: set.ptcgoCode ?? undefined,
    printedTotal: set.printedTotal ?? undefined,
    total: set.total ?? undefined
  }));
}

async function persistCachedCards(cards: ExploreCard[]): Promise<void> {
  if (!cards.length) return;
  try {
    await prisma.$transaction(
      cards.map((card) =>
        prisma.cachedCard.upsert({
          where: { id: card.id },
          update: {
            name: card.name,
            image: card.image,
            set: card.set,
            setId: card.setId,
            number: card.number,
            rarity: card.rarity,
            marketPrice: card.marketPrice
          },
          create: {
            id: card.id,
            name: card.name,
            image: card.image,
            set: card.set,
            setId: card.setId,
            number: card.number,
            rarity: card.rarity,
            marketPrice: card.marketPrice
          }
        })
      )
    );
  } catch (error) {
    console.warn(JSON.stringify({ level: "warn", message: "Persistent card cache write failed", error: String(error) }));
  }
}

async function persistCachedSets(sets: PokemonSet[]): Promise<void> {
  if (!sets.length) return;
  try {
    await prisma.$transaction(
      sets.map((set) =>
        prisma.cachedSet.upsert({
          where: { id: set.id },
          update: {
            name: set.name,
            series: set.series,
            ptcgoCode: set.ptcgoCode,
            printedTotal: set.printedTotal,
            total: set.total
          },
          create: {
            id: set.id,
            name: set.name,
            series: set.series,
            ptcgoCode: set.ptcgoCode,
            printedTotal: set.printedTotal,
            total: set.total
          }
        })
      )
    );
  } catch (error) {
    console.warn(JSON.stringify({ level: "warn", message: "Persistent set cache write failed", error: String(error) }));
  }
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
  ["black bolt", "sv10.5b"],
  ["dri", "sv10"],
  ["jtg", "sv09"],
  ["lor", "swsh11"],
  ["m23", "2023sv"],
  ["mee", "mee"],
  ["meg", "me01"],
  ["mega evolution", "me01"],
  ["mep", "mep"],
  ["mew", "sv03.5"],
  ["obf", "sv03"],
  ["paf", "sv04.5"],
  ["pal", "sv02"],
  ["par", "sv04"],
  ["pfl", "me02"],
  ["phantasmal flames", "me02"],
  ["por", "me03"],
  ["perfect order", "me03"],
  ["pre", "sv08.5"],
  ["cri", "me04"],
  ["scr", "sv07"],
  ["src", "sv07"],
  ["ssp", "sv08"],
  ["svi", "sv01"],
  ["svp", "svp"],
  ["tef", "sv05"],
  ["twm", "sv06"],
  ["umb", "svp"],
  ["wht", "sv10.5w"],
  ["white flare", "sv10.5w"],
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
  ["destined rivals", "sv10"],
  ["raio negro", "sv10.5b"],
  ["chama branca", "sv10.5w"],
  ["megavolucao", "me01"],
  ["mega evolucao", "me01"],
  ["chamas fantasmagoricas", "me02"],
  ["ascended heroes", "me02.5"],
  ["herois ascendentes", "me02.5"],
  ["ordem perfeita", "me03"],
  ["chaos rising", "me04"],
  ["caos ascendente", "me04"],
  ["caos crescente", "me04"]
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
      (aliasId ? equivalentSetIds(set.id).some((id) => equivalentSetIds(aliasId).includes(id)) : false)
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
  const sets = response.data.map((set, index) => ({
    id: set.id,
    name: set.name,
    series: inferSeriesFromSetId(set.id),
    ptcgoCode: preferredSetCode(set.id),
    printedTotal: set.cardCount?.official,
    total: set.cardCount?.total,
    sortOrder: index
  }));
  void persistCachedSets(sets);
  return setCached("tcgdex:sets", sets);
}

function preferredSetCode(setId: string): string {
  const setIds = equivalentSetIds(setId);
  const alias = Array.from(setAliases.entries()).find(([key, value]) => {
    const isCompactAlias = key.length <= 6 && /^[a-z0-9.]+$/.test(key);
    return isCompactAlias && equivalentSetIds(value).some((id) => setIds.includes(id));
  });

  return (alias?.[0] ?? setId).toUpperCase();
}

function inferSeriesFromSetId(setId: string): string | undefined {
  const normalized = setId.toLowerCase();
  if (normalized.startsWith("me")) return "Mega Evolution";
  if (normalized.startsWith("sv")) return "Scarlet & Violet";
  if (normalized.startsWith("swsh")) return "Sword & Shield";
  if (normalized.startsWith("sm")) return "Sun & Moon";
  if (normalized.startsWith("xy")) return "XY";
  if (/^a\d|^b\d/.test(normalized)) return "Pokemon Pocket";
  return undefined;
}

function setEquivalenceKey(set: PokemonSet): string {
  return equivalentSetIds(set.id).sort()[0] ?? set.id.toLowerCase();
}

function mergeSetData(preferred: PokemonSet, fallback: PokemonSet): PokemonSet {
  return {
    ...fallback,
    ...preferred,
    series: preferred.series ?? fallback.series,
    ptcgoCode: preferred.ptcgoCode ?? fallback.ptcgoCode,
    printedTotal: preferred.printedTotal ?? fallback.printedTotal,
    total: preferred.total ?? fallback.total,
    logo: preferred.logo ?? fallback.logo,
    symbol: preferred.symbol ?? fallback.symbol,
    releaseDate: preferred.releaseDate ?? fallback.releaseDate,
    sortOrder: Math.max(preferred.sortOrder ?? -1, fallback.sortOrder ?? -1)
  };
}

function compareSetsNewestFirst(a: PokemonSet, b: PokemonSet): number {
  const orderDiff = (b.sortOrder ?? -1) - (a.sortOrder ?? -1);
  if (orderDiff !== 0) return orderDiff;

  const bTime = b.releaseDate ? Date.parse(b.releaseDate.replaceAll("/", "-")) : 0;
  const aTime = a.releaseDate ? Date.parse(a.releaseDate.replaceAll("/", "-")) : 0;
  if (bTime !== aTime) return bTime - aTime;

  return a.name.localeCompare(b.name);
}

function mergeSetsByEquivalence(preferredSets: PokemonSet[], fallbackSets: PokemonSet[]): PokemonSet[] {
  const merged = new Map<string, PokemonSet>();

  for (const set of fallbackSets) {
    merged.set(setEquivalenceKey(set), set);
  }

  for (const set of preferredSets) {
    const key = setEquivalenceKey(set);
    const existing = merged.get(key);
    merged.set(key, existing ? mergeSetData(set, existing) : set);
  }

  return Array.from(merged.values()).sort(compareSetsNewestFirst);
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
  void persistCachedCards(enriched);

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

    try {
      return setCached(cacheKey, await listCardsFromTcgDex(page, pageSize, search, set, sort));
    } catch (error) {
      console.warn(JSON.stringify({ level: "warn", message: "TCGdex card listing failed", error: String(error) }));
    }

    const persisted = await listCardsFromPersistentCache(page, pageSize, search, set, sort);
    if (persisted) return setCached(cacheKey, persisted);

    // Fallback to Pokemon API if available (paid)
    if (env.pokemonApiKey) {
      try {
        return setCached(cacheKey, await listPokemonCards(page, pageSize, search, set, sort));
      } catch (error) {
        console.warn(JSON.stringify({ level: "warn", message: "Pokemon API card listing failed as fallback", error: String(error) }));
      }
    }

    throw new Error("All card listing sources failed");
  },

  async listSets(): Promise<PokemonSet[]> {
    const cached = getCached<PokemonSet[]>("sets");
    if (cached) return cached;

    const [pokemonResult, tcgDexResult] = await Promise.allSettled([listPokemonSets(), listTcgDexSets()]);
    const pokemonSets = pokemonResult.status === "fulfilled" ? pokemonResult.value : [];
    const tcgDexSets = tcgDexResult.status === "fulfilled" ? tcgDexResult.value : [];

    if (pokemonResult.status === "rejected") {
      console.warn(JSON.stringify({ level: "warn", message: "Pokemon API set listing failed", error: String(pokemonResult.reason) }));
    }
    if (tcgDexResult.status === "rejected") {
      console.warn(JSON.stringify({ level: "warn", message: "TCGdex set listing failed", error: String(tcgDexResult.reason) }));
    }

    if (pokemonSets.length || tcgDexSets.length) {
      return setCached("sets", mergeSetsByEquivalence(pokemonSets, tcgDexSets));
    }

    const persisted = await listSetsFromPersistentCache();
    if (persisted.length) return setCached("sets", persisted.sort(compareSetsNewestFirst));

    throw new Error("All set listing sources failed");
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
