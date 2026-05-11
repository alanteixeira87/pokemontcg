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

let ocrWorkerPromise: Promise<Awaited<ReturnType<typeof createWorker>>> | null = null;

async function getOcrWorker() {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = createWorker("eng+por", 1, {});
  }
  const worker = await ocrWorkerPromise;
  await worker.setParameters({
    tessedit_pageseg_mode: String(PSM.SPARSE_TEXT),
    preserve_interword_spaces: "1"
  });
  return worker;
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

function normalizeCardNumber(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

function normalizeSetCode(value: string): string {
  return value.replace(/[^A-Z0-9.]/gi, "").toUpperCase();
}

function parseOcrText(rawText: string, scanInput: Pick<ScanInput, "language" | "condition" | "variantType">): ExtractedScanData {
  const cleaned = rawText.replace(/\r/g, "\n");
  const lines = cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const numberRegex =
    /\b(?:\d{1,3}\/\d{2,3}|(?:TG|GG)\d{1,3}\/(?:TG|GG)\d{1,3}|(?:TG|GG|SVP)\d{1,3}|PROMO[-\s]?\d{1,3}|[A-Z]{1,4}\d{1,3})\b/gi;
  const cardNumbers = Array.from(
    new Set(
      (cleaned.match(numberRegex) ?? [])
        .map((entry) => normalizeCardNumber(entry.replace(/\s+/g, "")))
        .filter(Boolean)
    )
  );

  const codeRegex = /\b[A-Z0-9.]{2,7}\b/g;
  const setCodeCandidates = new Set<string>();
  for (const token of cleaned.toUpperCase().match(codeRegex) ?? []) {
    if (/^\d+$/.test(token)) continue;
    if (token.length < 2 || token.length > 6) continue;
    setCodeCandidates.add(normalizeSetCode(token));
  }

  const cardName =
    lines.find((line) => {
      const normalized = normalizeText(line);
      if (normalized.length < 3) return false;
      if (/\d/.test(normalized) && normalized.length < 6) return false;
      if (normalized.includes("pokemon") || normalized.includes("trading card game")) return false;
      return /[a-zA-Z]/.test(normalized);
    }) ?? null;

  const collectionName =
    lines.find((line) => {
      const normalized = normalizeText(line);
      return normalized.includes("scarlet") || normalized.includes("violet") || normalized.includes("sword") || normalized.includes("shield");
    }) ?? null;

  return {
    cardName,
    cardNumbers,
    collectionName,
    setCodes: Array.from(setCodeCandidates),
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
  return Math.round((2 * common * 100) / (aTokens.length + bTokens.length));
}

function confidenceLevel(score: number): ScanConfidenceLevel {
  if (score >= 85) return "HIGH";
  if (score >= 60) return "MEDIUM";
  return "LOW";
}

function scoreMatch(candidate: CachedCardCandidate, extracted: ExtractedScanData, setIdHints: Set<string>, setNameHints: Set<string>): ScanConfidence {
  let score = 0;
  const reasons: string[] = [];

  const candidateNumber = normalizeCardNumber(candidate.number ?? candidate.id.split("-").at(-1) ?? "");
  if (extracted.cardNumbers.some((number) => normalizeCardNumber(number) === candidateNumber)) {
    score += 60;
    reasons.push("Numero da carta confirmado");
  } else if (extracted.cardNumbers.length > 0 && extracted.cardNumbers.some((number) => candidateNumber.includes(number.split("/")[0] ?? ""))) {
    score += 35;
    reasons.push("Numero parcial identificado");
  }

  if (candidate.setId && setIdHints.has(normalizeSetCode(candidate.setId))) {
    score += 25;
    reasons.push("Codigo da colecao confirmado");
  } else if (setNameHints.has(normalizeText(candidate.set))) {
    score += 20;
    reasons.push("Colecao identificada por nome");
  }

  if (extracted.cardName) {
    const similarity = nameSimilarity(extracted.cardName, candidate.name);
    if (similarity >= 85) {
      score += 20;
      reasons.push("Nome da carta com alta similaridade");
    } else if (similarity >= 65) {
      score += 12;
      reasons.push("Nome da carta com similaridade moderada");
    } else if (similarity >= 45) {
      score += 6;
      reasons.push("Nome da carta com similaridade parcial");
    }
  }

  if (candidate.rarity && extracted.rarity && normalizeText(candidate.rarity) === normalizeText(extracted.rarity)) {
    score += 5;
    reasons.push("Raridade consistente");
  }

  if (score > 100) score = 100;
  return {
    score,
    level: confidenceLevel(score),
    reasons: reasons.length ? reasons : ["Correspondencia aproximada por fallback"]
  };
}

async function loadCandidates(extracted: ExtractedScanData): Promise<{ candidates: CachedCardCandidate[]; setIdHints: Set<string>; setNameHints: Set<string> }> {
  const sets = await pokemonService.listSets();
  const setIdHints = new Set<string>();
  const setNameHints = new Set<string>();

  for (const code of extracted.setCodes.map(normalizeSetCode)) {
    for (const set of sets) {
      const setId = normalizeSetCode(set.id);
      const ptcgo = normalizeSetCode(set.ptcgoCode ?? "");
      if (code && (code === setId || code === ptcgo)) {
        setIdHints.add(setId);
        setNameHints.add(normalizeText(set.name));
      }
    }
  }

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
    ...extracted.cardNumbers.map((number) => ({ number: { contains: number.split("/")[0] ?? number, mode: "insensitive" as const } })),
    ...(extracted.cardName ? [{ name: { contains: extracted.cardName, mode: "insensitive" as const } }] : []),
    ...Array.from(setNameHints).map((setName) => ({ set: { contains: setName, mode: "insensitive" as const } }))
  ];

  const where: Prisma.CachedCardWhereInput | undefined = orFilters.length ? { OR: orFilters } : undefined;

  const setIds = Array.from(setIdHints);
  if (setIds.length > 0 && where) {
    (where as NonNullable<typeof where>).setId = { in: setIds };
  }

  let cached = await prisma.cachedCard.findMany({
    where,
    take: 300
  });

  // Warm cache from external provider when local cache does not have enough candidates.
  if (cached.length < 3) {
    const firstSetId = setIds[0];
    if (firstSetId) {
      await pokemonService.listCards(1, 250, extracted.cardName ?? undefined, firstSetId, "numberAsc");
    } else if (extracted.cardName) {
      await pokemonService.listCards(1, 120, extracted.cardName, undefined, "name");
    } else {
      await pokemonService.listCards(1, 120, undefined, undefined, "numberAsc");
    }

    cached = await prisma.cachedCard.findMany({
      where,
      take: 300
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

export const scanService = {
  async analyze(input: ScanInput): Promise<ScanAnalysisResult> {
    const worker = await getOcrWorker();
    const result = await worker.recognize(input.imageBuffer);
    const rawText = result.data.text ?? "";
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
    const matches = candidates
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
      .sort((a, b) => b.confidence.score - a.confidence.score)
      .slice(0, 8);

    const bestMatch = matches[0] ?? null;
    const confidence = bestMatch?.confidence ?? {
      score: 0,
      level: "LOW" as const,
      reasons: ["Nao foi possivel identificar uma correspondencia segura"]
    };

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
      confidence,
      requiresManualConfirmation: confidence.score < 85,
      fallbackMessage:
        matches.length === 0 ? "Nao conseguimos identificar a carta automaticamente." : undefined
    };
  }
};
