import { ArrowUpRight, Boxes, CheckCircle2, ExternalLink, Layers3, PackageSearch, Search, ShoppingBag } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { metaDecks, type MetaDeck, type MetaDeckCard } from "../data/metaDecks";
import { cardDisplayName } from "../lib/cardDisplay";
import { currency } from "../lib/utils";
import { apiService } from "../services/api";
import type { CollectionItem } from "../types";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Skeleton } from "../components/ui/Skeleton";
import type { ToastState } from "../components/ui/Toast";

type DeckCardMatch = MetaDeckCard & {
  key: string;
  ownedQuantity: number;
  repeatedQuantity: number;
  usableRepeated: number;
  missingRepeated: number;
  ownedItems: CollectionItem[];
  image?: string;
  marketPrice: number;
};

type DeckSummary = {
  totalRequired: number;
  repeatedCovered: number;
  missingFromRepeated: number;
  ownedCovered: number;
  estimatedRepeatedValue: number;
};

const roleOrder: Record<MetaDeckCard["role"], number> = {
  Pokemon: 0,
  Treinador: 1,
  Energia: 2
};

export function Decks({ onToast }: { onToast: (toast: ToastState) => void }) {
  const [collection, setCollection] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeckId, setSelectedDeckId] = useState(metaDecks[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | MetaDeckCard["role"]>("all");
  const [cardImages, setCardImages] = useState<Record<string, string>>({});
  const selectedDeck = useMemo(() => metaDecks.find((deck) => deck.id === selectedDeckId) ?? metaDecks[0], [selectedDeckId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void apiService
      .collection({ sort: "name" })
      .then((items) => {
        if (active) setCollection(items);
      })
      .catch(() => {
        if (active) onToast({ type: "error", message: "Não foi possível carregar suas cartas repetidas para comparar os decks." });
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [onToast]);

  const collectionByName = useMemo(() => groupCollectionByName(collection), [collection]);
  const deckMatches = useMemo(() => buildDeckMatches(selectedDeck, collectionByName, cardImages), [cardImages, collectionByName, selectedDeck]);
  const summary = useMemo(() => summarizeDeck(deckMatches), [deckMatches]);
  const filteredMatches = useMemo(() => {
    const query = normalizeName(search);
    return deckMatches
      .filter((card) => (roleFilter === "all" ? true : card.role === roleFilter))
      .filter((card) => (query ? normalizeName(card.name).includes(query) : true))
      .sort((a, b) => roleOrder[a.role] - roleOrder[b.role] || b.missingRepeated - a.missingRepeated || a.name.localeCompare(b.name));
  }, [deckMatches, roleFilter, search]);
  const repeatedSaleCards = useMemo(() => deckMatches.filter((card) => card.usableRepeated > 0), [deckMatches]);
  const missingRepeatedCards = useMemo(() => deckMatches.filter((card) => card.missingRepeated > 0), [deckMatches]);

  useEffect(() => {
    let active = true;
    const missingImageCards = selectedDeck.cards.filter((card) => {
      const key = normalizeName(card.name);
      return !cardImages[key] && !collectionByName.get(key)?.[0]?.image;
    });
    if (!missingImageCards.length) return;

    void Promise.allSettled(
      missingImageCards.slice(0, 18).map(async (card) => {
        const result = await apiService.cards({ page: 1, pageSize: 1, search: card.name, sort: "name" });
        const found = result.cards[0];
        return found ? [normalizeName(card.name), found.image] as const : null;
      })
    ).then((results) => {
      if (!active) return;
      const next: Record<string, string> = {};
      results.forEach((result) => {
        if (result.status === "fulfilled" && result.value) {
          next[result.value[0]] = result.value[1];
        }
      });
      if (Object.keys(next).length) setCardImages((current) => ({ ...current, ...next }));
    });

    return () => {
      active = false;
    };
  }, [cardImages, collectionByName, selectedDeck]);

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="relative overflow-hidden border-b border-slate-100 bg-slate-950 p-5 text-white dark:border-slate-800">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.28),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.22),transparent_35%)]" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Decks competitivos</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">Radar de decks e cartas repetidas</h2>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                Compare os principais arquétipos do meta com suas cartas repetidas. O sistema considera como disponível para venda/troca apenas a quantidade acima de 1.
              </p>
            </div>
            <Button variant="secondary" onClick={() => window.open(selectedDeck.sourceUrl, "_blank")}>
              <ExternalLink size={16} />
              Fonte do deck
            </Button>
          </div>
        </div>

        <div className="grid gap-3 p-4 lg:grid-cols-[1fr_220px_220px]">
          <Select value={selectedDeckId} onChange={(event) => setSelectedDeckId(event.target.value)}>
            {metaDecks.map((deck) => (
              <option key={deck.id} value={deck.id}>
                {deck.name} - {deck.metaShare}
              </option>
            ))}
          </Select>
          <Select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as "all" | MetaDeckCard["role"])}>
            <option value="all">Todas as categorias</option>
            <option value="Pokemon">Pokémon</option>
            <option value="Treinador">Treinadores</option>
            <option value="Energia">Energias</option>
          </Select>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 text-muted-foreground" size={16} />
            <Input className="pl-9" placeholder="Buscar carta no deck" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DeckMetric icon={Layers3} label="Deck analisado" value={`${summary.totalRequired}/60`} hint="cartas na lista visual" />
        <DeckMetric icon={CheckCircle2} label="Repetidas úteis" value={summary.repeatedCovered} hint="cópias disponíveis para venda/troca" />
        <DeckMetric icon={PackageSearch} label="Faltam nas repetidas" value={summary.missingFromRepeated} hint="demanda do deck que não está sobrando" />
        <DeckMetric icon={ShoppingBag} label="Valor potencial" value={currency(summary.estimatedRepeatedValue)} hint="estimativa das repetidas aproveitáveis" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <aside className="space-y-4">
          <DeckOverview deck={selectedDeck} summary={summary} />
          <OpportunityPanel title="Temos repetidas para este deck" cards={repeatedSaleCards} empty="Nenhuma carta repetida encontrada para este deck." tone="success" />
          <OpportunityPanel title="Faltam nas repetidas" cards={missingRepeatedCards} empty="Suas repetidas cobrem todos os itens deste deck." tone="warning" />
        </aside>

        <div className="space-y-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-xl font-semibold text-slate-950 dark:text-white">Mapa visual do deck</h3>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Verde indica repetida disponível; amarelo indica parcial; cinza indica que falta nas repetidas.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {filteredMatches.length} cartas agrupadas
            </span>
          </div>

          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 9 }).map((_, index) => (
                <Skeleton key={index} className="h-56" />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredMatches.map((card) => (
                <DeckCardTile key={card.key} card={card} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function DeckOverview({ deck, summary }: { deck: MetaDeck; summary: DeckSummary }) {
  const coverage = summary.totalRequired ? Math.round((summary.repeatedCovered / summary.totalRequired) * 100) : 0;
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">{deck.format}</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">{deck.name}</h3>
          <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">{deck.archetype}</p>
        </div>
        <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-200">{deck.metaShare}</span>
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(coverage, 100)}%` }} />
      </div>
      <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">{coverage}% do deck coberto por cartas repetidas</p>
      <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">{deck.notes}</p>
      <a className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-300" href={deck.sourceUrl} target="_blank" rel="noreferrer">
        {deck.sourceLabel}
        <ArrowUpRight size={15} />
      </a>
    </article>
  );
}

function DeckMetric({ icon: Icon, label, value, hint }: { icon: typeof Boxes; label: string; value: string | number; hint: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <span className="rounded-xl bg-slate-100 p-2 text-indigo-600 dark:bg-slate-800 dark:text-indigo-300">
          <Icon size={20} />
        </span>
        <strong className="text-2xl font-semibold text-slate-950 dark:text-white">{value}</strong>
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
    </div>
  );
}

function OpportunityPanel({ title, cards, empty, tone }: { title: string; cards: DeckCardMatch[]; empty: string; tone: "success" | "warning" }) {
  const color = tone === "success" ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300";
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h3 className={`text-sm font-semibold ${color}`}>{title}</h3>
      <div className="mt-3 space-y-2">
        {cards.slice(0, 8).map((card) => (
          <div key={`${title}-${card.key}`} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-950/50">
            <span className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{card.name}</span>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {tone === "success" ? `${card.usableRepeated}/${card.quantity}` : `faltam ${card.missingRepeated}`}
            </span>
          </div>
        ))}
        {!cards.length && <p className="text-sm text-slate-500 dark:text-slate-400">{empty}</p>}
      </div>
    </article>
  );
}

function DeckCardTile({ card }: { card: DeckCardMatch }) {
  const status =
    card.usableRepeated >= card.quantity
      ? "Completo nas repetidas"
      : card.usableRepeated > 0
        ? "Parcial nas repetidas"
        : card.ownedQuantity > 0
          ? "Tem na coleção, mas não sobra"
          : "Falta nas repetidas";
  const borderClass =
    card.usableRepeated >= card.quantity
      ? "border-emerald-300 ring-2 ring-emerald-500/10"
      : card.usableRepeated > 0
        ? "border-amber-300 ring-2 ring-amber-500/10"
        : "border-slate-200 opacity-85 grayscale dark:border-slate-800";

  return (
    <article className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-900 ${borderClass}`}>
      <div className="relative bg-slate-100 px-4 pb-3 pt-4 dark:bg-slate-950/40">
        {card.image ? (
          <img src={card.image} alt={card.name} loading="lazy" className="mx-auto aspect-[63/88] w-full max-w-[138px] rounded-lg object-contain" />
        ) : (
          <div className="mx-auto flex aspect-[63/88] w-full max-w-[138px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-center text-xs font-semibold text-slate-400 dark:border-slate-700 dark:bg-slate-900">
            Sem imagem
          </div>
        )}
        <span className="absolute right-3 top-3 rounded-full bg-slate-950 px-2.5 py-1 text-[11px] font-bold text-white">x{card.quantity}</span>
      </div>
      <div className="space-y-3 border-t border-slate-100 p-4 dark:border-slate-800">
        <div>
          <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-slate-950 dark:text-white">{cardDisplayName(card.name, undefined, card.key)}</h3>
          <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{card.role}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <DeckCardStat label="Pede" value={card.quantity} />
          <DeckCardStat label="Sobra" value={card.repeatedQuantity} />
          <DeckCardStat label="Falta" value={card.missingRepeated} />
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-950/50">
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{status}</p>
          {card.ownedItems.length > 0 && (
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              {card.ownedQuantity} total na coleção, {card.repeatedQuantity} repetida(s)
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

function DeckCardStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2 py-2 dark:bg-slate-950/50">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <strong className="text-sm text-slate-950 dark:text-white">{value}</strong>
    </div>
  );
}

function groupCollectionByName(items: CollectionItem[]): Map<string, CollectionItem[]> {
  const map = new Map<string, CollectionItem[]>();
  items.forEach((item) => {
    const key = normalizeName(item.name);
    const current = map.get(key) ?? [];
    current.push(item);
    map.set(key, current);
  });
  return map;
}

function buildDeckMatches(deck: MetaDeck, collectionByName: Map<string, CollectionItem[]>, cardImages: Record<string, string>): DeckCardMatch[] {
  return deck.cards.map((card) => {
    const key = normalizeName(card.name);
    const ownedItems = collectionByName.get(key) ?? [];
    const ownedQuantity = ownedItems.reduce((sum, item) => sum + item.quantity, 0);
    const repeatedQuantity = Math.max(0, ownedQuantity - 1);
    const usableRepeated = Math.min(card.quantity, repeatedQuantity);
    const marketPrice = ownedItems[0]?.price ?? 0;
    return {
      ...card,
      key,
      ownedQuantity,
      repeatedQuantity,
      usableRepeated,
      missingRepeated: Math.max(0, card.quantity - usableRepeated),
      ownedItems,
      image: ownedItems[0]?.image ?? cardImages[key],
      marketPrice
    };
  });
}

function summarizeDeck(cards: DeckCardMatch[]): DeckSummary {
  return cards.reduce<DeckSummary>(
    (summary, card) => ({
      totalRequired: summary.totalRequired + card.quantity,
      repeatedCovered: summary.repeatedCovered + card.usableRepeated,
      missingFromRepeated: summary.missingFromRepeated + card.missingRepeated,
      ownedCovered: summary.ownedCovered + Math.min(card.quantity, card.ownedQuantity),
      estimatedRepeatedValue: summary.estimatedRepeatedValue + card.usableRepeated * card.marketPrice
    }),
    { totalRequired: 0, repeatedCovered: 0, missingFromRepeated: 0, ownedCovered: 0, estimatedRepeatedValue: 0 }
  );
}

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
