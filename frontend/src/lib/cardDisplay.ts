export function cardDisplayNumber(number?: string | null, cardId?: string): string {
  const fallbackIdNumber = cardId?.startsWith("restored-") ? "" : cardId?.split("-").at(-1)?.trim() || "";
  const raw = number?.trim() || fallbackIdNumber;
  return raw ? `#${raw}` : "#N/D";
}

export function cardDisplayName(name: string, number?: string | null, cardId?: string): string {
  return `${cardDisplayNumber(number, cardId)} - ${name}`;
}

export function cardNumberRank(number?: string | null): number {
  const raw = number?.trim() ?? "";
  const numeric = raw.match(/\d+/)?.[0];
  if (!numeric) return 0;
  const parsed = Number(numeric);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function realCollectionTotal(numbers: Array<string | null | undefined>, fallback?: number | null): number {
  const maxNumber = numbers.reduce((max, number) => Math.max(max, cardNumberRank(number)), 0);
  const officialTotal = Number.isFinite(fallback) && Number(fallback) > 0 ? Number(fallback) : 0;
  return Math.max(maxNumber, officialTotal);
}
