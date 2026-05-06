export function cardDisplayNumber(number?: string | null, cardId?: string): string {
  const raw = number?.trim() || cardId?.split("-").at(-1)?.trim() || "";
  return raw ? `#${raw}` : "#N/D";
}

export function cardDisplayName(name: string, number?: string | null, cardId?: string): string {
  return `${cardDisplayNumber(number, cardId)} - ${name}`;
}

export function cardNumberRank(number?: string | null): number {
  const raw = number?.trim() ?? "";
  const numeric = raw.match(/\d+/)?.[0];
  const parsed = Number(numeric ?? Number.MAX_SAFE_INTEGER);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

export function realCollectionTotal(numbers: Array<string | null | undefined>, fallback?: number | null): number {
  const maxNumber = numbers.reduce((max, number) => Math.max(max, cardNumberRank(number)), 0);
  return Math.max(maxNumber, fallback ?? 0);
}
