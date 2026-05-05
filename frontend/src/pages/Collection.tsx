import { AlertTriangle, BarChart3, Download, Heart, Layers3, Plus, RefreshCw, Trash2, Trophy, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CardTile } from "../components/CardTile";
import { EmptyState } from "../components/EmptyState";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import { Skeleton } from "../components/ui/Skeleton";
import { Modal } from "../components/ui/Modal";
import { apiService } from "../services/api";
import { useAppStore } from "../store/useAppStore";
import type { CollectionItem, ExploreCard, PokemonSet } from "../types";
import type { ToastState } from "../components/ui/Toast";

export function Collection({ tradeOnly = false, onToast }: { tradeOnly?: boolean; onToast: (toast: ToastState) => void }) {
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [allItems, setAllItems] = useState<CollectionItem[]>([]);
  const [availableSets, setAvailableSets] = useState<string[]>([]);
  const [pokemonSets, setPokemonSets] = useState<PokemonSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [repricing, setRepricing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<CollectionItem | null>(null);
  const [setCards, setSetCards] = useState<ExploreCard[]>([]);
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const { filters, setFilters } = useAppStore();

  const loadMeta = useCallback(async () => {
    if (tradeOnly) return;
    try {
      const [collectionData, setsData] = await Promise.all([apiService.collection({ sort: "name" }), apiService.sets()]);
      setAllItems(collectionData);
      setAvailableSets(Array.from(new Set(collectionData.map((item) => item.set))).sort());
      setPokemonSets(setsData);
    } catch {
      onToast({ type: "error", message: "Nao foi possivel carregar progresso das colecoes." });
    }
  }, [onToast, tradeOnly]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = tradeOnly
        ? await apiService.trades()
        : await apiService.collection({
            set: filters.set || undefined,
            favorite: filters.favorite || undefined,
            forTrade: filters.forTrade || undefined,
            sort: filters.sort
          });
      setItems(data);
    } catch {
      onToast({ type: "error", message: "Nao foi possivel carregar sua colecao." });
    } finally {
      setLoading(false);
    }
  }, [filters.favorite, filters.forTrade, filters.set, filters.sort, onToast, tradeOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    if (tradeOnly) return;
    void apiService
      .wishlist()
      .then((wishlist) => setWishlistIds(new Set(wishlist.map((item) => item.cardId))))
      .catch(() => undefined);
  }, [tradeOnly]);

  useEffect(() => {
    if (tradeOnly || !filters.set || pokemonSets.length === 0) {
      setSetCards([]);
      return;
    }

    const selectedSet = pokemonSets.find((set) => normalizeSetName(set.name) === normalizeSetName(filters.set));
    if (!selectedSet) {
      setSetCards([]);
      return;
    }

    void apiService
      .cards({ page: 1, pageSize: 500, set: selectedSet.id, sort: "numberAsc" })
      .then((result) => setSetCards(result.cards))
      .catch(() => onToast({ type: "error", message: "Nao foi possivel carregar cartas faltantes desta colecao." }));
  }, [filters.set, onToast, pokemonSets, tradeOnly]);

  const sets = useMemo(() => availableSets, [availableSets]);
  const collectionSummary = useMemo(() => buildCollectionSummary(allItems, pokemonSets), [allItems, pokemonSets]);
  const missingCards = useMemo(() => {
    if (!filters.set) return [];
    const ownedIds = new Set(allItems.filter((item) => normalizeSetName(item.set) === normalizeSetName(filters.set)).map((item) => item.cardId));
    return setCards.filter((card) => !ownedIds.has(card.id));
  }, [allItems, filters.set, setCards]);
  const totalUnique = allItems.length;
  const totalCopies = useMemo(() => allItems.reduce((sum, item) => sum + item.quantity, 0), [allItems]);
  const completedSets = collectionSummary.filter((set) => set.percent >= 100).length;

  async function update(id: number, data: Partial<Pick<CollectionItem, "quantity" | "price" | "favorite" | "forTrade">>) {
    const previous = items;
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...data } : item)));
    try {
      const updated = await apiService.updateCollection(id, data);
      setItems((current) => current.map((item) => (item.id === id ? updated : item)));
      setAllItems((current) => current.map((item) => (item.id === id ? updated : item)));
    } catch {
      setItems(previous);
      onToast({ type: "error", message: "Alteracao revertida por erro ao salvar." });
    }
  }

  async function remove(id: number) {
    const previous = items;
    setItems((current) => current.filter((item) => item.id !== id));
    try {
      await apiService.removeCollection(id);
      setAllItems((current) => current.filter((item) => item.id !== id));
      onToast({ type: "success", message: "Carta removida da colecao." });
    } catch {
      setItems(previous);
      onToast({ type: "error", message: "Nao foi possivel remover a carta." });
    }
  }

  async function addMissing(card: ExploreCard) {
    try {
      await apiService.addToCollection(card, 1);
      await load();
      await loadMeta();
      onToast({ type: "success", message: "Carta adicionada a colecao." });
    } catch {
      onToast({ type: "error", message: "Nao foi possivel adicionar esta carta." });
    }
  }

  async function toggleMissingWishlist(card: ExploreCard) {
    const wished = wishlistIds.has(card.id);
    setWishlistIds((current) => {
      const next = new Set(current);
      if (wished) next.delete(card.id);
      else next.add(card.id);
      return next;
    });

    try {
      if (wished) await apiService.removeWishlist(card.id);
      else await apiService.addWishlist(card);
      onToast({ type: "success", message: wished ? "Carta removida da lista de desejos." : "Carta adicionada a lista de desejos." });
    } catch {
      onToast({ type: "error", message: "Nao foi possivel atualizar a lista de desejos." });
    }
  }

  function exportCard(cardId: string) {
    window.open(apiService.exportUrl("card", cardId), "_blank");
  }

  async function importExcel(file: File | undefined) {
    if (!file) return;
    setImporting(true);
    try {
      const result = await apiService.importCollection(file);
      await load();
      await loadMeta();
      const firstIssue = result.notFound[0];
      const notFoundMessage = result.notFound.length
        ? ` ${result.notFound.length} nao encontradas. ${firstIssue?.reason ?? ""}`
        : "";
      onToast({
        type: result.imported > 0 ? "success" : "error",
        message: `${result.imported} cartas importadas. ${result.skipped} linhas ignoradas.${notFoundMessage}`
      });
    } catch {
      onToast({ type: "error", message: "Nao foi possivel importar a planilha. Confira as colunas e tente novamente." });
    } finally {
      setImporting(false);
    }
  }

  async function clearCollection() {
    if (!confirmClear) {
      setConfirmClear(true);
      onToast({ type: "error", message: "Clique novamente em limpar colecao para confirmar." });
      window.setTimeout(() => setConfirmClear(false), 5000);
      return;
    }

    try {
      const result = await apiService.clearCollection();
      setItems([]);
      setAllItems([]);
      setAvailableSets([]);
      setConfirmClear(false);
      setFilters({ set: "", favorite: false, forTrade: false });
      onToast({ type: "success", message: `${result.deleted} cartas removidas da sua colecao.` });
    } catch {
      onToast({ type: "error", message: "Nao foi possivel limpar a colecao." });
    }
  }

  async function refreshPrices() {
    setRepricing(true);
    try {
      const result = await apiService.refreshCollectionPrices();
      await load();
      await loadMeta();
      onToast({ type: "success", message: `${result.updated} precos atualizados. ${result.skipped} mantidos.` });
    } catch {
      onToast({ type: "error", message: "Nao foi possivel atualizar os precos agora." });
    } finally {
      setRepricing(false);
    }
  }

  return (
    <div className="space-y-5">
      {!tradeOnly && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">Minha colecao Pokemon TCG</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">Minha pasta</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Acompanhe progresso por colecao, quantidade, favoritos e cartas para troca.</p>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:min-w-[420px]">
                <MetricCard icon={Layers3} label="Unicas" value={totalUnique} />
                <MetricCard icon={BarChart3} label="Copias" value={totalCopies} />
                <MetricCard icon={Trophy} label="Sets 100%" value={completedSets} />
              </div>
            </div>
          </div>
          <div className="p-4">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-950 dark:text-white">Filtros e organizacao</h3>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Controle quantidade, preco, favoritos e cartas para troca.</p>
            </div>
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">{items.length} cartas no filtro</span>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
          <Select value={filters.set} onChange={(event) => setFilters({ set: event.target.value })}>
            <option value="">Todos os sets</option>
            {sets.map((set) => (
              <option key={set} value={set}>
                {set}
              </option>
            ))}
          </Select>
          <Select value={filters.favorite ? "true" : "false"} onChange={(event) => setFilters({ favorite: event.target.value === "true" })}>
            <option value="false">Todos os itens</option>
            <option value="true">Apenas favoritas</option>
          </Select>
          <Select value={filters.forTrade ? "true" : "false"} onChange={(event) => setFilters({ forTrade: event.target.value === "true" })}>
            <option value="false">Todos os status</option>
            <option value="true">Apenas troca</option>
          </Select>
          <Select value={filters.sort} onChange={(event) => setFilters({ sort: event.target.value as typeof filters.sort })}>
            <option value="numberAsc">Numero menor-maior</option>
            <option value="numberDesc">Numero maior-menor</option>
            <option value="name">Nome A-Z</option>
            <option value="price">Preco</option>
            <option value="quantity">Quantidade</option>
          </Select>
          </div>
          </div>
        </section>
      )}

      {!tradeOnly && collectionSummary.length > 0 && (
        <section className="space-y-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-xl font-semibold text-slate-950 dark:text-white">Progresso por colecao</h3>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Cada card mostra quantas cartas unicas voce ja tem naquele set.</p>
            </div>
            <span className="text-sm font-semibold text-slate-500">{collectionSummary.length} colecoes iniciadas</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {collectionSummary.map((set) => (
              <button
                key={set.name}
                type="button"
                onClick={() => setFilters({ set: set.name })}
                className="group rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition duration-150 hover:scale-[1.01] hover:border-indigo-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="inline-flex rounded-md bg-slate-900 px-2 py-1 text-xs font-semibold uppercase text-white">
                      {set.code}
                    </span>
                    <h4 className="mt-3 truncate text-base font-semibold text-slate-950">{set.name}</h4>
                    <p className="mt-1 text-xs font-medium text-slate-500">{set.series || "Serie Pokemon TCG"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-semibold text-indigo-600">{set.percent}%</p>
                    <p className="text-xs font-semibold text-slate-500">{set.owned}/{set.totalLabel}</p>
                  </div>
                </div>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all"
                    style={{ width: `${Math.min(set.percent, 100)}%` }}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs font-semibold text-slate-500">
                  <span>{set.missingLabel}</span>
                  <span className="text-indigo-600 group-hover:underline">Filtrar set</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        {!tradeOnly && (
          <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
            <Upload size={16} />
            {importing ? "Importando..." : "Importar Excel"}
            <input
              className="hidden"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={importing}
              onChange={(event) => {
                void importExcel(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
        )}
        {!tradeOnly && (
          <Button variant="secondary" disabled={repricing || allItems.length === 0} onClick={refreshPrices}>
            <RefreshCw size={16} className={repricing ? "animate-spin" : ""} />
            {repricing ? "Atualizando..." : "Atualizar precos"}
          </Button>
        )}
        {!tradeOnly && (
          <Button variant={confirmClear ? "danger" : "secondary"} disabled={allItems.length === 0} onClick={clearCollection}>
            {confirmClear ? <AlertTriangle size={16} /> : <Trash2 size={16} />}
            {confirmClear ? "Confirmar limpeza" : "Limpar colecao"}
          </Button>
        )}
        <Button variant="secondary" onClick={() => window.open(apiService.exportUrl("full"), "_blank")}>
          <Download size={16} />
          Completo
        </Button>
        {filters.set && !tradeOnly && (
          <Button variant="secondary" onClick={() => window.open(apiService.exportUrl("set", filters.set), "_blank")}>
            <Download size={16} />
            Por set
          </Button>
        )}
      </div>

      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => (
            <Skeleton key={index} className="h-96" />
          ))}
        </div>
      ) : items.length ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {items.map((item) => (
            <CardTile key={item.id} mode="collection" card={item} onUpdate={update} onRemove={() => setPendingRemove(item)} onExport={exportCard} />
          ))}
          {!tradeOnly &&
            missingCards.map((card) => (
              <MissingCard key={`missing-${card.id}`} card={card} wished={wishlistIds.has(card.id)} onAdd={addMissing} onToggleWishlist={toggleMissingWishlist} />
            ))}
        </div>
      ) : !tradeOnly && missingCards.length ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {missingCards.map((card) => (
            <MissingCard key={`missing-${card.id}`} card={card} wished={wishlistIds.has(card.id)} onAdd={addMissing} onToggleWishlist={toggleMissingWishlist} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={tradeOnly ? "Nenhuma carta para troca" : "Colecao vazia"}
          description={tradeOnly ? "Marque cartas como troca para visualiza-las aqui." : "Explore cartas e adicione os primeiros itens a sua colecao local."}
        />
      )}
      <Modal title="Remover carta" open={Boolean(pendingRemove)} onClose={() => setPendingRemove(null)}>
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">Deseja realmente remover esta carta da sua colecao?</p>
          {pendingRemove && <p className="rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-950 dark:bg-slate-950/50 dark:text-white">{pendingRemove.name}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPendingRemove(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!pendingRemove) return;
                void remove(pendingRemove.id);
                setPendingRemove(null);
              }}
            >
              Remover
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function MissingCard({ card, wished, onAdd, onToggleWishlist }: { card: ExploreCard; wished: boolean; onAdd: (card: ExploreCard) => void; onToggleWishlist: (card: ExploreCard) => void }) {
  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white opacity-75 grayscale transition hover:opacity-100 hover:grayscale-0 dark:border-slate-800 dark:bg-slate-900">
      <div className="relative bg-slate-100 px-4 pb-3 pt-4 dark:bg-slate-950/40">
        <img src={card.image} alt={card.name} loading="lazy" className="mx-auto aspect-[63/88] w-full max-w-[184px] rounded-lg object-contain" />
        <span className="absolute right-3 top-3 rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white">Faltante</span>
        <button
          type="button"
          onClick={() => onToggleWishlist(card)}
          className={`absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm transition hover:scale-105 dark:bg-slate-900 ${
            wished ? "text-rose-500" : "text-slate-400 hover:text-rose-500"
          }`}
          aria-label="Lista de desejos"
        >
          <Heart size={17} fill={wished ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="space-y-3 border-t border-slate-100 p-4 dark:border-slate-800">
        <div>
          <h3 className="line-clamp-2 min-h-10 text-[15px] font-semibold leading-5 text-slate-950 dark:text-white">{card.name}</h3>
          <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{card.set} - #{card.number ?? "N/D"}</p>
        </div>
        <Button className="w-full" variant="secondary" onClick={() => onAdd(card)}>
          <Plus size={16} />
          Adicionar manualmente
        </Button>
      </div>
    </article>
  );
}

type ProgressSet = {
  name: string;
  code: string;
  series?: string;
  owned: number;
  total: number | null;
  totalLabel: string;
  percent: number;
  missingLabel: string;
};

function normalizeSetName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function buildCollectionSummary(items: CollectionItem[], pokemonSets: PokemonSet[]): ProgressSet[] {
  const grouped = new Map<string, CollectionItem[]>();
  items.forEach((item) => {
    const current = grouped.get(item.set) ?? [];
    current.push(item);
    grouped.set(item.set, current);
  });

  return Array.from(grouped.entries())
    .map(([setName, setItems]) => {
      const apiSet = pokemonSets.find((set) => normalizeSetName(set.name) === normalizeSetName(setName));
      const total = apiSet?.printedTotal ?? apiSet?.total ?? null;
      const owned = new Set(setItems.map((item) => item.cardId)).size;
      const percent = total ? Math.min(100, Math.round((owned / total) * 100)) : 100;
      const code = apiSet?.ptcgoCode ?? apiSet?.id ?? setName.slice(0, 3).toUpperCase();
      return {
        name: setName,
        code,
        series: apiSet?.series,
        owned,
        total,
        totalLabel: total ? String(total) : `${owned}+`,
        percent,
        missingLabel: total ? `${Math.max(total - owned, 0)} faltantes` : "Total nao informado"
      };
    })
    .sort((a, b) => b.percent - a.percent || b.owned - a.owned || a.name.localeCompare(b.name));
}

function MetricCard({ icon: Icon, label, value }: { icon: typeof Layers3; label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-950/35">
      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300">
        <Icon size={16} />
      </div>
      <p className="text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-xl font-semibold text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}



