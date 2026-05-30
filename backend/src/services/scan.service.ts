import { prisma } from "../database/prisma.js";
import { pokemonService } from "./pokemon.service.js";
import { createWorker, PSM } from "tesseract.js";
import type { Prisma } from "@prisma/client";

type ScanInput = {
  imageBuffer: Buffer;
  language?: string;
  condition?: string;
  variantType?: string;
};

type ExtractedScanData = {
  cardName: string | null;
  cardNumbers: string[];
  collectionName: string | null;
  setCodes: string[];
  rarity: string | null;
  variantType: string;
  language: string;
  condition: string;
  rawText: string;
};

type ScanConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

export type ScanConfidence = {
  score: number;
  level: ScanConfidenceLevel;
  reasons: string[];
};

export type ScanMatch = {
  cardId: string;
  name: string;
  image: string;
  set: string;
  setId: string | null;
  number: string | null;
  rarity: string | null;
  marketPrice: number | null;
  confidence: ScanConfidence;
};

export type ScanAnalysisResult = {
  extracted: Omit<ExtractedScanData, "rawText">;
  rawText: string;
  matches: ScanMatch[];
  bestMatch: ScanMatch | null;
  confidence: ScanConfidence;
  requiresManualConfirmation: boolean;
  fallbackMessage?: string;
};

type CachedCardCandidate = {
  id: string;
  name: string;
  image: string;
  set: string;
  setId: string | null;
  number: string | null;
  rarity: string | null;
  marketPrice: number | null;
};

const OCR_NUMBER_WHITELIST = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/-. ";
const setAliases = new Map<string, string>([
  ["asc", "me02.5"],
  ["black bolt", "sv10.5b"],
  ["blk", "sv10.5b"],
  ["chaos rising", "me04"],
  ["cri", "me04"],
  ["mew", "sv03.5"],
  ["meg", "me01"],
  ["mega evolution", "me01"],
  ["paf", "sv04.5"],
  ["perfect order", "me03"],
  ["phantasmal flames", "me02"],
  ["pfl", "me02"],
  ["por", "me03"],
  ["pre", "sv08.5"],
  ["ssp", "sv08"],
  ["svi", "sv01"],
  ["svp", "svp"],
  ["tef", "sv05"],
  ["twm", "sv06"],
  ["white flare", "sv10.5w"],
  ["wht", "sv10.5w"],
  ["151", "sv03.5"],
  ["destined rivals", "sv10"],
  ["jornada juntos", "sv09"],
  ["rivais destinados", "sv10"],
  ["evolucoes prismaticas", "sv08.5"],
  ["raio negro", "sv10.5b"],
  ["chama branca", "sv10.5w"],
  ["megavolucao", "me01"],
  ["mega evolucao", "me01"],
  ["chamas fantasmagoricas", "me02"],
  ["ascended heroes", "me02.5"],
  ["herois ascendentes", "me02.5"],
  ["ordem perfeita", "me03"],
  ["caos ascendente", "me04"],
  ["caos crescente", "me04"]
]);

let ocrWorkerPromise: Promise<Awaited<ReturnType<typeof createWorker>>> | null = null;

async function getOcrWorker() {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = createWorker("eng+por", 1, {});
  }
  const worker = await ocrWorkerPromise;
  return worker;
}

async function runOcrPasses(worker: Awaited<ReturnType<typeof createWorker>>, imageBuffer: Buffer): Promise<string> {
  const passes: Array<{ psm: number; whitelist?: string }> = [
    { psm: PSM.SPARSE_TEXT },
    { psm: PSM.SINGLE_BLOCK },
    { psm: PSM.SPARSE_TEXT, whitelist: OCR_NUMBER_WHITELIST }
  ];

  const parts: string[] = [];
  for (const pass of passes) {
    await worker.setParameters({
      tessedit_pageseg_mode: String(pass.psm),
      preserve_interword_spaces: "1",
      tessedit_char_whitelist: pass.whitelist ?? ""
    });
    const recognized = await worker.recognize(imageBuffer, { rotateAuto: true });
    const text = recognized.data.text?.trim();
    if (text) parts.push(text);
  }

  return parts.join("\n");
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}/.-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeSetCode(value: string): string {
  return value.replace(/[^A-Z0-9.]/gi, "").toUpperCase();
}

function normalizeCardNumber(value: string): string {
  return value.toUpperCase().replace(/\s+/g, "");
}

function compactCode(value: string): string {
  return normalizeText(value).replace(/\s+/g, "");
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
  const megaShort = normalized.replace(/^me0(\d)(.*)$/, "me$1$2");
  const megaLong = normalized.replace(/^me(\d)(.*)$/, "me0$1$2");
  const megaPtToDot = normalized.replace(/^me0?(\d)pt(\d+)$/, "me0$1.$2");
  const megaDotToPt = normalized.replace(/^me0?(\d)\.(\d+)$/, "me$1pt$2");
  const explicit = specialEquivalentSetIds.get(normalized) ?? [];

  return Array.from(
    new Set([normalized, scarletVioletShort, scarletVioletLong, ptToDot, dotToPt, megaShort, megaLong, megaPtToDot, megaDotToPt, ...explicit].filter(Boolean))
  );
}

function fixAmbiguousToken(raw: string): string {
  const chars = raw.toUpperCase().split("");
  let hasDigit = false;
  for (const ch of chars) {
    if (/[0-9]/.test(ch)) {
      hasDigit = true;
      break;
    }
  }
  if (!hasDigit) return chars.join("");

  return chars
    .map((ch) => {
      if (ch === "O") return "0";
      if (ch === "I" || ch === "L") return "1";
      if (ch === "S") return "5";
      if (ch === "B") return "8";
      if (ch === "Z") return "2";
      return ch;
    })
    .join("");
}

function normalizeNumberLoose(value: string): string {
  const raw = fixAmbiguousToken(value).replace(/\s+/g, "").toUpperCase();
  return raw.replace(/-/g, "");
}

function numberKeys(value: string): string[] {
  const normalized = normalizeNumberLoose(value);
  const keys = new Set<string>([normalized]);

  const fraction = normalized.match(/^([A-Z]*)(\d{1,3})\/([A-Z]*)(\d{1,3})$/);
  if (fraction) {
    const [, aPrefix, aNum, bPrefix, bNum] = fraction;
    keys.add(`${aPrefix}${String(Number(aNum))}/${bPrefix}${String(Number(bNum))}`);
  }

  const prefixed = normalized.match(/^([A-Z]+)(\d{1,4})$/);
  if (prefixed) {
    const [, prefix, num] = prefixed;
    keys.add(`${prefix}${String(Number(num))}`);
  }

  const plain = normalized.match(/^(\d{1,4})\/(\d{1,4})$/);
  if (plain) {
    const [, a, b] = plain;
    keys.add(`${String(Number(a))}/${String(Number(b))}`);
  }

  return Array.from(keys);
}

function numbersMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const aKeys = new Set(numberKeys(a));
  return numberKeys(b).some((key) => aKeys.has(key));
}

function extractCardNumbers(rawText: string): string[] {
  const clean = rawText.replace(/\s+/g, " ").toUpperCase();
  const numberRegex = /\b(?:\d{1,3}\/\d{2,3}|(?:TG|GG)\d{1,3}\/(?:TG|GG)\d{1,3}|(?:TG|GG|SVP)\d{1,3}|PROMO[-\s]?\d{1,3}|[A-Z]{2,4}\d{1,4})\b/g;
  const found = clean.match(numberRegex) ?? [];

  const candidates = new Set<string>();
  for (const hit of found) {
    const fixed = fixAmbiguousToken(hit).replace(/\s+/g, "");
    candidates.add(normalizeCardNumber(fixed));
  }

  return Array.from(candidates);
}

function pickLikelyCardName(lines: string[]): string | null {
  const blacklist = ["pokemon", "trading card game", "hp", "weakness", "resistance", "retreat"];
  const candidates = lines
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => /[A-Za-z]/.test(line))
    .filter((line) => line.length >= 3 && line.length <= 42)
    .filter((line) => !blacklist.some((term) => normalizeText(line).includes(term)))
    .sort((a, b) => scoreNameLine(b) - scoreNameLine(a));

  return candidates[0] ?? null;
}

function scoreNameLine(line: string): number {
  const letters = (line.match(/[A-Za-z]/g) ?? []).length;
  const digits = (line.match(/[0-9]/g) ?? []).length;
  const words = line.trim().split(/\s+/).length;
  return letters * 3 - digits * 2 + Math.min(words, 4) * 2;
}

function parseOcrText(rawText: string, scanInput: Pick<ScanInput, "language" | "condition" | "variantType">): ExtractedScanData {
  const cleaned = rawText.replace(/\r/g, "\n");
  const lines = cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const cardNumbers = extractCardNumbers(cleaned);

  const codeRegex = /\b[A-Z0-9.]{2,7}\b/g;
  const setCodes = Array.from(
    new Set((cleaned.toUpperCase().match(codeRegex) ?? []).map((token) => normalizeSetCode(fixAmbiguousToken(token))).filter((token) => /[A-Z]/.test(token)))
  );

  const collectionName =
    lines.find((line) => {
      const normalized = normalizeText(line);
      return normalized.includes("scarlet") || normalized.includes("violet") || normalized.includes("sword") || normalized.includes("shield");
    }) ?? null;

  return {
    cardName: pickLikelyCardName(lines),
    cardNumbers,
    collectionName,
    setCodes,
    rarity: null,
    variantType: scanInput.variantType?.trim() || "NORMAL",
    language: scanInput.language?.trim() || "PT-BR",
    condition: scanInput.condition?.trim() || "Nao informado",
    rawText: cleaned
  };
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(" ")
    .filter(Boolean);
}

function nameSimilarity(a: string, b: string): number {
  const aTokens = tokenize(a);
  const bTokens = tokenize(b);
  if (!aTokens.length || !bTokens.length) return 0;

  const common = aTokens.filter((token) => bTokens.includes(token)).length;
  const tokenScore = Math.round((2 * common * 100) / (aTokens.length + bTokens.length));

  const aFlat = aTokens.join("");
  const bFlat = bTokens.join("");
  const editScore = 100 - Math.min(100, levenshteinDistance(aFlat, bFlat) * 4);

  return Math.round(tokenScore * 0.7 + editScore * 0.3);
}

function levenshteinDistance(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }

  return matrix[a.length][b.length];
}

function confidenceLevel(score: number): ScanConfidenceLevel {
  if (score >= 85) return "HIGH";
  if (score >= 60) return "MEDIUM";
  return "LOW";
}

function scoreMatch(candidate: CachedCardCandidate, extracted: ExtractedScanData, setIdHints: Set<string>, setNameHints: Set<string>): ScanConfidence {
  let score = 0;
  const reasons: string[] = [];

  const hasNumberHint = extracted.cardNumbers.length > 0;
  const hasSetHint = setIdHints.size > 0 || setNameHints.size > 0;

  const numberExact = extracted.cardNumbers.some((n) => numbersMatch(candidate.number ?? candidate.id.split("-").at(-1) ?? "", n));
  const setExact = candidate.setId ? setIdHints.has(normalizeSetCode(candidate.setId)) : false;
  const setByName = setNameHints.has(normalizeText(candidate.set));

  if (numberExact && setExact) {
    score += 88;
    reasons.push("Numero + codigo da colecao confirmados");
  } else if (numberExact && setByName) {
    score += 82;
    reasons.push("Numero + nome da colecao confirmados");
  } else if (numberExact) {
    score += 64;
    reasons.push("Numero da carta confirmado");
  } else if (hasNumberHint) {
    score -= 30;
    reasons.push("Numero divergente");
  }

  if (setExact && !numberExact) {
    score += 14;
    reasons.push("Codigo da colecao consistente");
  } else if (setByName && !numberExact) {
    score += 10;
    reasons.push("Nome da colecao consistente");
  } else if (hasSetHint && !setExact && !setByName) {
    score -= 18;
    reasons.push("Colecao divergente");
  }

  if (extracted.cardName) {
    const similarity = nameSimilarity(extracted.cardName, candidate.name);
    if (similarity >= 90) {
      score += 16;
      reasons.push("Nome com alta similaridade");
    } else if (similarity >= 75) {
      score += 10;
      reasons.push("Nome com boa similaridade");
    } else if (similarity >= 55) {
      score += 4;
      reasons.push("Nome com similaridade parcial");
    } else {
      score -= 10;
      reasons.push("Nome pouco consistente");
    }
  }

  if (candidate.rarity && extracted.rarity && normalizeText(candidate.rarity) === normalizeText(extracted.rarity)) {
    score += 3;
    reasons.push("Raridade consistente");
  }

  if (hasNumberHint && hasSetHint && !(numberExact && (setExact || setByName))) {
    score -= 8;
    reasons.push("Dados principais nao fecharam completamente");
  }

  score = Math.max(0, Math.min(score, 100));
  return {
    score,
    level: confidenceLevel(score),
    reasons: reasons.length ? reasons : ["Correspondencia aproximada por fallback"]
  };
}

function matchSetHintsFromCodes(codes: string[], sets: Array<{ id: string; name: string; ptcgoCode?: string | null }>) {
  const setIdHints = new Set<string>();
  const setNameHints = new Set<string>();

  for (const code of codes.map(normalizeSetCode)) {
    for (const set of sets) {
      const candidates = [set.id, set.ptcgoCode ?? "", ...equivalentSetIds(set.id)].map((item) => normalizeSetCode(item));
      if (candidates.includes(code)) {
        setIdHints.add(normalizeSetCode(set.id));
        setNameHints.add(normalizeText(set.name));
      }
    }
  }

  const alias = Array.from(codes)
    .map((code) => setAliases.get(compactCode(code)))
    .filter(Boolean) as string[];

  for (const aliasSetId of alias) {
    for (const set of sets) {
      const setIds = equivalentSetIds(set.id);
      if (setIds.some((id) => equivalentSetIds(aliasSetId).includes(id))) {
        setIdHints.add(normalizeSetCode(set.id));
        setNameHints.add(normalizeText(set.name));
      }
    }
  }

  return { setIdHints, setNameHints };
}

async function loadCandidates(extracted: ExtractedScanData): Promise<{ candidates: CachedCardCandidate[]; setIdHints: Set<string>; setNameHints: Set<string> }> {
  const sets = await pokemonService.listSets();
  const { setIdHints, setNameHints } = matchSetHintsFromCodes(extracted.setCodes, sets);

  if (extracted.collectionName) {
    const normalizedCollection = normalizeText(extracted.collectionName);
    for (const set of sets) {
      const normalizedSet = normalizeText(set.name);
      if (normalizedSet.includes(normalizedCollection) || normalizedCollection.includes(normalizedSet)) {
        setIdHints.add(normalizeSetCode(set.id));
        setNameHints.add(normalizedSet);
      }
    }
  }

  const orFilters: Prisma.CachedCardWhereInput[] = [
    ...extracted.cardNumbers.map((number) => ({ number: { contains: number.replace(/[^0-9]/g, "").slice(0, 4), mode: "insensitive" as const } })),
    ...(extracted.cardName ? [{ name: { contains: extracted.cardName, mode: "insensitive" as const } }] : []),
    ...Array.from(setNameHints).map((setName) => ({ set: { contains: setName, mode: "insensitive" as const } }))
  ].filter((entry) => {
    const asAny = entry as { number?: { contains?: string } };
    return !asAny.number || Boolean(asAny.number.contains);
  });

  const where: Prisma.CachedCardWhereInput | undefined = orFilters.length ? { OR: orFilters } : undefined;

  const setIds = Array.from(setIdHints);
  if (setIds.length > 0 && where) {
    where.setId = { in: setIds };
  }

  let cached = await prisma.cachedCard.findMany({
    where,
    take: 450
  });

  if (cached.length < 6) {
    const firstSetId = setIds[0];
    if (firstSetId) {
      await pokemonService.listCards(1, 250, extracted.cardName ?? undefined, firstSetId, "numberAsc");
    } else if (extracted.cardName) {
      await pokemonService.listCards(1, 180, extracted.cardName, undefined, "name");
    } else {
      await pokemonService.listCards(1, 180, undefined, undefined, "numberAsc");
    }

    cached = await prisma.cachedCard.findMany({
      where,
      take: 450
    });
  }

  return {
    candidates: cached.map((card) => ({
      id: card.id,
      name: card.name,
      image: card.image,
      set: card.set,
      setId: card.setId ?? null,
      number: card.number ?? null,
      rarity: card.rarity ?? null,
      marketPrice: card.marketPrice
    })),
    setIdHints,
    setNameHints
  };
}

async function fetchExactNumberSetCandidates(extracted: ExtractedScanData, setIdHints: Set<string>): Promise<CachedCardCandidate[]> {
  if (!extracted.cardNumbers.length || !setIdHints.size) return [];

  const exactCards: CachedCardCandidate[] = [];
  const searched = new Set<string>();

  for (const setIdHint of setIdHints) {
    for (const number of extracted.cardNumbers) {
      const key = `${setIdHint}:${number}`;
      if (searched.has(key)) continue;
      searched.add(key);

      const exact = await pokemonService.findCardBySetAndNumber(setIdHint, number);
      if (!exact) continue;

      exactCards.push({
        id: exact.id,
        name: exact.name,
        image: exact.image,
        set: exact.set,
        setId: exact.setId ?? null,
        number: exact.number ?? null,
        rarity: exact.rarity ?? null,
        marketPrice: exact.marketPrice
      });
    }
  }

  return exactCards;
}

export const scanService = {
  async analyze(input: ScanInput): Promise<ScanAnalysisResult> {
    const worker = await getOcrWorker();
    const rawText = await runOcrPasses(worker, input.imageBuffer);
    const extracted = parseOcrText(rawText, input);

    if (!extracted.cardName && extracted.cardNumbers.length === 0 && extracted.setCodes.length === 0) {
      return {
        extracted: {
          cardName: extracted.cardName,
          cardNumbers: extracted.cardNumbers,
          collectionName: extracted.collectionName,
          setCodes: extracted.setCodes,
          rarity: extracted.rarity,
          variantType: extracted.variantType,
          language: extracted.language,
          condition: extracted.condition
        },
        rawText,
        matches: [],
        bestMatch: null,
        confidence: {
          score: 0,
          level: "LOW",
          reasons: ["OCR parcial sem dados suficientes para correspondencia"]
        },
        requiresManualConfirmation: true,
        fallbackMessage: "Nao conseguimos identificar a carta automaticamente."
      };
    }

    const { candidates, setIdHints, setNameHints } = await loadCandidates(extracted);
    const exactCandidates = await fetchExactNumberSetCandidates(extracted, setIdHints);
    const mergedCandidates = [...exactCandidates, ...candidates];

    const scored = mergedCandidates
      .map((candidate) => ({
        cardId: candidate.id,
        name: candidate.name,
        image: candidate.image,
        set: candidate.set,
        setId: candidate.setId,
        number: candidate.number,
        rarity: candidate.rarity,
        marketPrice: candidate.marketPrice,
        confidence: scoreMatch(candidate, extracted, setIdHints, setNameHints)
      }))
      .filter((match) => match.confidence.score >= 35)
      .sort((a, b) => b.confidence.score - a.confidence.score || a.name.localeCompare(b.name));

    const dedup = new Map<string, (typeof scored)[number]>();
    for (const match of scored) {
      if (!dedup.has(match.cardId)) dedup.set(match.cardId, match);
    }

    const matches = Array.from(dedup.values()).slice(0, 8);
    const bestMatch = matches[0] ?? null;
    const secondMatch = matches[1] ?? null;

    const confidence = bestMatch?.confidence ?? {
      score: 0,
      level: "LOW" as const,
      reasons: ["Nao foi possivel identificar uma correspondencia segura"]
    };

    const isAmbiguousTopResults =
      Boolean(bestMatch && secondMatch) &&
      bestMatch!.confidence.score >= 80 &&
      secondMatch!.confidence.score >= 80 &&
      Math.abs(bestMatch!.confidence.score - secondMatch!.confidence.score) <= 5;

    if (isAmbiguousTopResults && bestMatch) {
      bestMatch.confidence = {
        ...bestMatch.confidence,
        score: Math.max(0, bestMatch.confidence.score - 8),
        level: confidenceLevel(Math.max(0, bestMatch.confidence.score - 8)),
        reasons: [...bestMatch.confidence.reasons, "Resultado proximo de outra carta (revisao manual recomendada)"]
      };
    }

    return {
      extracted: {
        cardName: extracted.cardName,
        cardNumbers: extracted.cardNumbers,
        collectionName: extracted.collectionName,
        setCodes: extracted.setCodes,
        rarity: extracted.rarity,
        variantType: extracted.variantType,
        language: extracted.language,
        condition: extracted.condition
      },
      rawText,
      matches,
      bestMatch,
      confidence: isAmbiguousTopResults && bestMatch ? bestMatch.confidence : confidence,
      requiresManualConfirmation: (isAmbiguousTopResults && Boolean(bestMatch)) || confidence.score < 85,
      fallbackMessage: matches.length === 0 ? "Nao conseguimos identificar a carta automaticamente." : undefined
    };
  }
};
