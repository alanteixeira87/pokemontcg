import { AlertTriangle, BarChart3, CheckSquare, ChevronDown, ChevronUp, Columns3, Download, Grid3X3, Heart, Layers3, List, Plus, RefreshCw, SlidersHorizontal, Trash2, Trophy, Upload } from "lucide-react";
import axios from "axios";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CardTile } from "../components/CardTile";
import { EmptyState } from "../components/EmptyState";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import { Skeleton } from "../components/ui/Skeleton";
import { Modal } from "../components/ui/Modal";
import { apiService } from "../services/api";
import { useAppStore } from "../store/useAppStore";
import type { CollectionItem, ExploreCard, PokemonSet, SortOption } from "../types";
import type { ToastState } from "../components/ui/Toast";
import { cardDisplayName, cardDisplayNumber, realCollectionTotal } from "../lib/cardDisplay";
import { currency } from "../lib/utils";

export function Collection({ tradeOnly = false, onToast }: { tradeOnly?: boolean; onToast: (toast: ToastState) => void }) {
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [allItems, setAllItems] = useState<CollectionItem[]>([]);
  const [pokemonSets, setPokemonSets] = useState<PokemonSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [repricing, setRepricing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<CollectionItem | null>(null);
  const [setCards, setSetCards] = useState<ExploreCard[]>([]);
  const [allMissingCards, setAllMissingCards] = useState<ExploreCard[]>([]);
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const [activeMissingIds, setActiveMissingIds] = useState<Set<string>>(new Set());
  const [collectionViewMode, setCollectionViewMode] = useState<"grid" | "list" | "columns">("grid");
  const [selectedMissingIds, setSelectedMissingIds] = useState<Set<string>>(new Set());
  const [missingQuantities, setMissingQuantities] = useState<Record<string, number>>({});
  const [confirmBatchMissing, setConfirmBatchMissing] = useState(false);
  const [showSelectedCollectionOnly, setShowSelectedCollectionOnly] = useState(false);
  const [loadingMissingCards, setLoadingMissingCards] = useState(false);
  const [downloadingRepeatedPdf, setDownloadingRepeatedPdf] = useState(false);
  const { filters, setFilters } = useAppStore();
  const [draftFilters, setDraftFilters] = useState(filters);
  const restoreScrollRef = useRef<number | null>(null);
  const setCardsCacheRef = useRef<Map<string, ExploreCard[]>>(new Map());

  const loadMeta = useCallback(async () => {
    if (tradeOnly) return;
    const [collectionResult, setsResult] = await Promise.allSettled([apiService.collection({ sort: "name" }), apiService.sets()]);

    if (collectionResult.status === "fulfilled") {
      setAllItems(collectionResult.value);
    } else {
      setAllItems([]);
      onToast({ type: "error", message: "Não foi possível carregar o progresso das coleções." });
    }

    if (setsResult.status === "fulfilled") {
      setPokemonSets(setsResult.value);
    } else {
      setPokemonSets([]);
      onToast({ type: "error", message: "Não foi possível carregar a lista oficial de coleções." });
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
      onToast({ type: "error", message: "Não foi possível carregar sua coleção." });
    } finally {
      setLoading(false);
    }
  }, [filters.favorite, filters.forTrade, filters.set, filters.sort, onToast, tradeOnly]);

  const loadSetCardsCached = useCallback(async (setId: string): Promise<ExploreCard[]> => {
    const cached = setCardsCacheRef.current.get(setId);
    if (cached) return cached;
    const cards = await loadSetCards(setId);
    setCardsCacheRef.current.set(setId, cards);
    return cards;
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    setDraftFilters(filters);
  }, [filters]);

  useEffect(() => {
    let active = true;
    if (tradeOnly) return;
    void apiService
      .wishlist()
      .then((wishlist) => {
        if (active) setWishlistIds(new Set(wishlist.map((item) => item.cardId)));
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [tradeOnly]);

  useEffect(() => {
    let active = true;
    if (tradeOnly || !filters.set || pokemonSets.length === 0) {
      setSetCards([]);
      setLoadingMissingCards(false);
      return;
    }

    const selectedSet = pokemonSets.find((set) => normalizeSetName(set.name) === normalizeSetName(filters.set));
    if (!selectedSet) {
      setSetCards([]);
      setLoadingMissingCards(false);
      return;
    }

    setLoadingMissingCards(true);
    void loadSetCardsCached(selectedSet.id)
      .then((cards) => {
        if (!active) return;
        setSetCards(cards);
        setLoadingMissingCards(false);
      })
      .catch(() => {
        if (!active) return;
        setSetCards([]);
        setLoadingMissingCards(false);
        onToast({ type: "error", message: "Não foi possível carregar as cartas faltantes desta coleção." });
      });

    return () => {
      active = false;
    };
  }, [filters.set, loadSetCardsCached, onToast, pokemonSets, tradeOnly]);

  useEffect(() => {
    let active = true;
    if (tradeOnly || filters.set || !filters.missingOnly || pokemonSets.length === 0) {
      setAllMissingCards([]);
      setLoadingMissingCards(false);
      return;
    }

    const ownedBySet = new Map<string, CollectionItem[]>();
    allItems.forEach((item) => {
      const setKey = normalizeSetName(item.set);
      const owned = ownedBySet.get(setKey) ?? [];
      owned.push(item);
      ownedBySet.set(setKey, owned);
    });

    const load = async () => {
      const missing: ExploreCard[] = [];
      const targetSets = Array.from(ownedBySet.keys())
        .map((setKey) => pokemonSets.find((set) => normalizeSetName(set.name) === setKey))
        .filter((set): set is PokemonSet => Boolean(set));

      const concurrency = 3;
      for (let index = 0; index < targetSets.length; index += concurrency) {
        const chunk = targetSets.slice(index, index + concurrency);
        const chunkResults = await Promise.allSettled(chunk.map((set) => loadSetCardsCached(set.id)));
        chunkResults.forEach((result, chunkIndex) => {
          if (result.status !== "fulfilled") return;
          const set = chunk[chunkIndex];
          if (!set) return;
          const setKey = normalizeSetName(set.name);
          const ownership = matchOwnedCards(result.value, ownedBySet.get(setKey) ?? []);
          result.value.forEach((card) => {
            if (!ownership.has(card.id)) missing.push(card);
          });
        });
      }

      return missing;
    };

    setLoadingMissingCards(true);
    void load()
      .then((cards) => {
        if (!active) return;
        setAllMissingCards(cards);
        setLoadingMissingCards(false);
      })
      .catch(() => {
        if (!active) return;
        setAllMissingCards([]);
        setLoadingMissingCards(false);
        onToast({ type: "error", message: "Não foi possível carregar as cartas faltantes de todas as coleções." });
      });

    return () => {
      active = false;
    };
  }, [allItems, filters.missingOnly, filters.set, loadSetCardsCached, onToast, pokemonSets, tradeOnly]);

  const sets = useMemo(() => Array.from(new Set(allItems.map((item) => item.set))).sort(), [allItems]);
  const collectionSummary = useMemo(() => buildCollectionSummary(allItems, pokemonSets), [allItems, pokemonSets]);
  const selectedSummary = useMemo(
    () => collectionSummary.find((set) => normalizeSetName(set.name) === normalizeSetName(filters.set)),
    [collectionSummary, filters.set]
  );
  const displayedSummary = useMemo(
    () => (showSelectedCollectionOnly && selectedSummary ? [selectedSummary] : collectionSummary),
    [collectionSummary, selectedSummary, showSelectedCollectionOnly]
  );
  const missingCards = useMemo(() => {
    if (!filters.set) return [];
    const ownership = matchOwnedCards(
      setCards,
      allItems.filter((item) => normalizeSetName(item.set) === normalizeSetName(filters.set))
    );
    return setCards
      .filter((card) => !ownership.has(card.id))
      .filter((card) => (filters.favorite ? wishlistIds.has(card.id) : true))
      .filter(() => (filters.forTrade ? false : true));
  }, [allItems, filters.favorite, filters.forTrade, filters.set, setCards, wishlistIds]);
  const ownedByCardId = useMemo(() => {
    if (!filters.set) return new Map(items.map((item) => [item.cardId, item]));
    return matchOwnedCards(setCards, items);
  }, [filters.set, items, setCards]);
  const missingById = useMemo(() => {
    const map = new Map<string, ExploreCard>();
    missingCards.forEach((card) => map.set(card.id, card));
    return map;
  }, [missingCards]);
  const setOrderedEntries = useMemo<Array<{ type: "owned"; item: CollectionItem } | { type: "missing"; card: ExploreCard }>>(() => {
    if (!filters.set) return [];
    return setCards.reduce<Array<{ type: "owned"; item: CollectionItem } | { type: "missing"; card: ExploreCard }>>((acc, card) => {
      const owned = ownedByCardId.get(card.id);
      if (owned) {
        acc.push({ type: "owned" as const, item: owned });
        return acc;
      }
      const missing = missingById.get(card.id);
      if (missing) acc.push({ type: "missing" as const, card: missing });
      return acc;
    }, []);
  }, [filters.set, missingById, ownedByCardId, setCards]);
  const visibleItems = filters.missingOnly ? [] : filters.set ? [] : items;
  const visibleMissingCards = filters.set
    ? missingCards
    : filters.missingOnly
      ? allMissingCards
          .filter((card) => (filters.favorite ? wishlistIds.has(card.id) : true))
          .sort((a, b) => normalizeSetName(a.set).localeCompare(normalizeSetName(b.set)) || cardNumberValue(a.number) - cardNumberValue(b.number) || a.name.localeCompare(b.name))
      : [];
  const hasSetOrderedCards = Boolean(filters.set) && setOrderedEntries.length > 0 && !tradeOnly && !filters.missingOnly;
  const collectionDisplayEntries = useMemo<Array<{ type: "owned"; item: CollectionItem } | { type: "missing"; card: ExploreCard }>>(() => {
    if (tradeOnly) return [];
    if (hasSetOrderedCards) return setOrderedEntries;
    return [
      ...visibleItems.map((item) => ({ type: "owned" as const, item })),
      ...visibleMissingCards.map((card) => ({ type: "missing" as const, card }))
    ];
  }, [hasSetOrderedCards, setOrderedEntries, tradeOnly, visibleItems, visibleMissingCards]);
  const selectableMissingCards = useMemo(
    () => collectionDisplayEntries.flatMap((entry) => (entry.type === "missing" ? [entry.card] : [])),
    [collectionDisplayEntries]
  );
  const selectableMissingIdsKey = useMemo(() => selectableMissingCards.map((card) => card.id).join("|"), [selectableMissingCards]);
  const selectedMissingCards = useMemo(() => selectableMissingCards.filter((card) => selectedMissingIds.has(card.id)), [selectableMissingCards, selectedMissingIds]);
  const totalSelectedMissingCopies = useMemo(
    () => selectedMissingCards.reduce((sum, card) => sum + (missingQuantities[card.id] ?? 1), 0),
    [missingQuantities, selectedMissingCards]
  );
  const canUseMissingSelection = !tradeOnly && selectableMissingCards.length > 0;
  const canUseCollectionView = !tradeOnly && collectionDisplayEntries.length > 0;
  const shouldUseCollectionView = canUseCollectionView && collectionViewMode !== "grid";
  const hasPendingFilterChanges = useMemo(
    () =>
      draftFilters.set !== filters.set ||
      draftFilters.favorite !== filters.favorite ||
      draftFilters.forTrade !== filters.forTrade ||
      draftFilters.missingOnly !== filters.missingOnly ||
      draftFilters.sort !== filters.sort,
    [draftFilters.favorite, draftFilters.forTrade, draftFilters.missingOnly, draftFilters.set, draftFilters.sort, filters.favorite, filters.forTrade, filters.missingOnly, filters.set, filters.sort]
  );
  const totalUnique = allItems.length;
  const totalCopies = useMemo(() => allItems.reduce((sum, item) => sum + item.quantity, 0), [allItems]);
  const completedSets = collectionSummary.filter((set) => set.percent >= 100).length;
  const isGridLoading = loading || (filters.missingOnly && loadingMissingCards);

  useEffect(() => {
    if (showSelectedCollectionOnly && !selectedSummary) {
      setShowSelectedCollectionOnly(false);
    }
  }, [selectedSummary, showSelectedCollectionOnly]);

  useEffect(() => {
    if (!filters.set) {
      setShowSelectedCollectionOnly(false);
      setActiveMissingIds(new Set());
    }
  }, [filters.set]);

  useEffect(() => {
    setActiveMissingIds(new Set());
  }, [filters.set, setCards.length]);

  useEffect(() => {
    setSelectedMissingIds(new Set());
    setConfirmBatchMissing(false);
  }, [filters.favorite, filters.forTrade, filters.missingOnly, filters.set, selectableMissingIdsKey]);

  useEffect(() => {
    if (restoreScrollRef.current === null) return;
    const nextScroll = restoreScrollRef.current;
    restoreScrollRef.current = null;
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: nextScroll, behavior: "auto" });
    });
  }, [allItems, items]);

  function preserveScrollPosition() {
    restoreScrollRef.current = window.scrollY;
  }

  function updateDraftFilters(next: Partial<{ set: string; favorite: boolean; forTrade: boolean; missingOnly: boolean; sort: SortOption }>) {
    setDraftFilters((current) => ({ ...current, ...next }));
  }

  function applySelectedFilters() {
    setFilters(draftFilters);
    setShowSelectedCollectionOnly(Boolean(draftFilters.set));
  }

  function clearSelectedFilters() {
    const reset = { set: "", favorite: false, forTrade: false, missingOnly: false, sort: "numberAsc" as SortOption };
    setDraftFilters(reset);
    setFilters(reset);
    setShowSelectedCollectionOnly(false);
  }

  function applySetFilter(setName: string) {
    setDraftFilters((current) => ({ ...current, set: setName }));
    setFilters({ set: setName });
    setShowSelectedCollectionOnly(Boolean(setName));
  }

  function setMissingQuantity(cardId: string, quantity: number) {
    setMissingQuantities((current) => ({ ...current, [cardId]: Math.max(1, quantity) }));
  }

  function toggleSelectedMissing(cardId: string) {
    setSelectedMissingIds((current) => {
      const next = new Set(current);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  }

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
    preserveScrollPosition();
    setItems((current) => current.filter((item) => item.id !== id));
    try {
      await apiService.removeCollection(id);
      setAllItems((current) => current.filter((item) => item.id !== id));
      onToast({ type: "success", message: "Carta removida da coleção." });
    } catch {
      setItems(previous);
      onToast({ type: "error", message: "Não foi possível remover a carta." });
    }
  }

  async function addMissing(card: ExploreCard, quantity = missingQuantities[card.id] ?? 1) {
    setActiveMissingIds((current) => new Set(current).add(card.id));
    try {
      preserveScrollPosition();
      const created = await apiService.addToCollection(card, quantity);
      setAllItems((current) => upsertCollectionItem(current, created, "name"));
      if (!filters.missingOnly && matchesCollectionFilters(created, filters.set, filters.favorite, filters.forTrade)) {
        setItems((current) => upsertCollectionItem(current, created, filters.sort));
      }
      setSelectedMissingIds((current) => {
        if (!current.has(card.id)) return current;
        const next = new Set(current);
        next.delete(card.id);
        return next;
      });
      onToast({ type: "success", message: `${quantity} cópia(s) adicionada(s) à coleção.` });
    } catch {
      onToast({ type: "error", message: "Não foi possível adicionar esta carta." });
    }
  }

  async function addSelectedMissing() {
    if (selectedMissingCards.length === 0) return;
    try {
      preserveScrollPosition();
      const createdItems = await Promise.all(selectedMissingCards.map((card) => apiService.addToCollection(card, missingQuantities[card.id] ?? 1)));
      setAllItems((current) => createdItems.reduce((next, item) => upsertCollectionItem(next, item, "name"), current));
      if (!filters.missingOnly) {
        setItems((current) =>
          createdItems
            .filter((item) => matchesCollectionFilters(item, filters.set, filters.favorite, filters.forTrade))
            .reduce((next, item) => upsertCollectionItem(next, item, filters.sort), current)
        );
      }
      setSelectedMissingIds(new Set());
      setConfirmBatchMissing(false);
      onToast({ type: "success", message: `${selectedMissingCards.length} carta(s) e ${totalSelectedMissingCopies} cópia(s) adicionada(s) à coleção.` });
    } catch {
      onToast({ type: "error", message: "Não foi possível adicionar as cartas selecionadas." });
    }
  }

  function markMissingAsActive(cardId: string) {
    setActiveMissingIds((current) => {
      if (current.has(cardId)) return current;
      const next = new Set(current);
      next.add(cardId);
      return next;
    });
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
      onToast({ type: "error", message: "Não foi possível atualizar a lista de desejos." });
    }
  }

  function exportCard(cardId: string) {
    window.open(apiService.exportUrl("card", cardId), "_blank");
  }

  async function downloadRepeatedPdf() {
    if (!filters.set) {
      onToast({ type: "error", message: "Selecione um set para baixar o PDF de repetidas." });
      return;
    }
    setDownloadingRepeatedPdf(true);
    try {
      const result = await apiService.downloadExport("repeatedPdf", filters.set);
      downloadBlob(result.blob, result.filename);
      onToast({ type: "success", message: "Download do PDF iniciado." });
    } catch (error) {
      const message = await extractDownloadErrorMessage(error);
      onToast({ type: "error", message: `${message} Tentando modo alternativo...` });
      window.location.assign(apiService.exportUrl("repeatedPdf", filters.set));
    } finally {
      setDownloadingRepeatedPdf(false);
    }
  }

  async function importExcel(file: File | undefined) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      onToast({ type: "error", message: "Selecione uma planilha no formato .xlsx." });
      return;
    }
    setImporting(true);
    try {
      const result = await apiService.importCollection(file);
      setCardsCacheRef.current.clear();
      await load();
      await loadMeta();
      const firstIssue = result.notFound[0];
      const notFoundMessage = result.notFound.length
         ? ` ${result.notFound.length} não encontradas. ${firstIssue?.reason ?? ""}`
        : "";
      onToast({
        type: result.imported > 0 ? "success" : "error",
        message: `${result.imported} cartas importadas. ${result.skipped} linhas ignoradas.${notFoundMessage}`
      });
    } catch (error) {
      const apiMessage = axios.isAxiosError(error) ? error.response?.data?.message : null;
      const timeoutMessage = axios.isAxiosError(error) && error.code === "ECONNABORTED" ? "A importação excedeu o tempo esperado." : null;
      onToast({
        type: "error",
        message: apiMessage || timeoutMessage || "Não foi possível importar a planilha. Confira as colunas e tente novamente."
      });
    } finally {
      setImporting(false);
    }
  }

  async function clearCollection() {
    if (!confirmClear) {
      setConfirmClear(true);
      onToast({ type: "error", message: "Clique novamente em limpar coleção para confirmar." });
      window.setTimeout(() => setConfirmClear(false), 5000);
      return;
    }

    try {
      const result = await apiService.clearCollection();
      setItems([]);
      setAllItems([]);
      setConfirmClear(false);
      setShowSelectedCollectionOnly(false);
      setFilters({ set: "", favorite: false, forTrade: false, missingOnly: false });
      onToast({ type: "success", message: `${result.deleted} cartas removidas da sua coleção.` });
    } catch {
      onToast({ type: "error", message: "Não foi possível limpar a coleção." });
    }
  }

  async function refreshPrices() {
    setRepricing(true);
    try {
      const result = await apiService.refreshCollectionPrices();
      await load();
      await loadMeta();
      onToast({ type: "success", message: `${result.updated} preços atualizados. ${result.skipped} mantidos.` });
    } catch {
      onToast({ type: "error", message: "Não foi possível atualizar os preços agora." });
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
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">Pokédex Pokémon TCG</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">Pokédex</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Acompanhe o progresso por coleção, quantidade, favoritos e cartas para troca.</p>
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
              <h3 className="text-lg font-semibold text-slate-950 dark:text-white">Filtros e organização</h3>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Controle quantidade, preço, favoritos e cartas para troca.</p>
            </div>
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">{items.length} cartas no filtro</span>
          </div>
          <div className="grid gap-3 md:grid-cols-5">
          <Select value={draftFilters.set} onChange={(event) => updateDraftFilters({ set: event.target.value })}>
            <option value="">Todos os sets</option>
            {sets.map((set) => (
              <option key={set} value={set}>
                {set}
              </option>
            ))}
          </Select>
          <Select value={draftFilters.favorite ? "true" : "false"} onChange={(event) => updateDraftFilters({ favorite: event.target.value === "true" })}>
            <option value="false">Todos os itens</option>
            <option value="true">Apenas favoritas</option>
          </Select>
          <Select value={draftFilters.forTrade ? "true" : "false"} onChange={(event) => updateDraftFilters({ forTrade: event.target.value === "true" })}>
            <option value="false">Todos os status</option>
            <option value="true">Apenas troca</option>
          </Select>
          <Select value={draftFilters.missingOnly ? "true" : "false"} onChange={(event) => updateDraftFilters({ missingOnly: event.target.value === "true" })}>
            <option value="false">Possuídas e faltantes</option>
            <option value="true">Apenas cartas faltantes</option>
          </Select>
          <Select value={draftFilters.sort} onChange={(event) => updateDraftFilters({ sort: event.target.value as SortOption })}>
            <option value="numberAsc">Numero menor-maior</option>
            <option value="numberDesc">Numero maior-menor</option>
            <option value="name">Nome A-Z</option>
            <option value="price">Preco</option>
            <option value="quantity">Quantidade</option>
          </Select>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button className="w-full sm:w-auto" variant="primary" onClick={applySelectedFilters}>
              <SlidersHorizontal size={16} />
              Aplicar filtros selecionados
            </Button>
            <Button className="w-full sm:w-auto" variant="secondary" onClick={clearSelectedFilters}>
              Limpar filtros
            </Button>
            {hasPendingFilterChanges && <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-300">Filtros pendentes de aplicacao</span>}
          </div>
          {loadingMissingCards && <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Carregando cartas faltantes...</p>}
          </div>
        </section>
      )}

      {!tradeOnly && collectionSummary.length > 0 && (
        <section className="space-y-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-xl font-semibold text-slate-950 dark:text-white">Progresso por coleção</h3>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Cada card mostra quantas cartas únicas você já tem naquele set.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">{collectionSummary.length} coleções iniciadas</span>
              <Button
                variant="secondary"
                size="sm"
                disabled={!selectedSummary && !showSelectedCollectionOnly}
                onClick={() => setShowSelectedCollectionOnly((current) => !current)}
              >
                {showSelectedCollectionOnly ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                {showSelectedCollectionOnly ? "Mostrar todas" : "Recolher coleções"}
              </Button>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {displayedSummary.map((set) => (
              <button
                key={set.name}
                type="button"
                onClick={() => applySetFilter(set.name)}
                className="group rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition duration-150 hover:scale-[1.01] hover:border-indigo-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="inline-flex rounded-md bg-slate-900 px-2 py-1 text-xs font-semibold uppercase text-white">
                      {set.code}
                    </span>
                    <h4 className="mt-3 truncate text-base font-semibold text-slate-950 dark:text-white">{set.name}</h4>
                    <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{set.series || "Série Pokémon TCG"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-semibold text-indigo-600 dark:text-indigo-300">{set.percent}%</p>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{set.owned}/{set.totalLabel}</p>
                  </div>
                </div>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all"
                    style={{ width: `${Math.min(set.percent, 100)}%` }}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <span>{set.missingLabel}</span>
                  <span className="text-indigo-600 dark:text-indigo-300 group-hover:underline">Filtrar set</span>
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
            {repricing ? "Atualizando..." : "Atualizar preços"}
          </Button>
        )}
        {!tradeOnly && (
          <Button variant={confirmClear ? "danger" : "secondary"} disabled={allItems.length === 0} onClick={clearCollection}>
            {confirmClear ? <AlertTriangle size={16} /> : <Trash2 size={16} />}
            {confirmClear ? "Confirmar limpeza" : "Limpar coleção"}
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
        {!tradeOnly && (
          <Button
            variant="primary"
            className="shadow-md"
            disabled={!filters.set || downloadingRepeatedPdf}
            onClick={() => void downloadRepeatedPdf()}
          >
            <Download size={16} />
            {downloadingRepeatedPdf ? "Gerando PDF..." : "Download PDF repetidas (A4)"}
          </Button>
        )}
        {!tradeOnly && (
          <Button variant="secondary" onClick={() => window.open(apiService.exportUrl("missing", filters.set || undefined), "_blank")}>
            <Download size={16} />
            Faltantes
          </Button>
        )}
      </div>

      {canUseCollectionView && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="flex items-center gap-1">
            <CollectionModeButton active={collectionViewMode === "grid"} onClick={() => setCollectionViewMode("grid")} icon={Grid3X3} label="Grid" />
            <CollectionModeButton active={collectionViewMode === "list"} onClick={() => setCollectionViewMode("list")} icon={List} label="Lista" />
            <CollectionModeButton active={collectionViewMode === "columns"} onClick={() => setCollectionViewMode("columns")} icon={Columns3} label="Colunas" />
          </div>
          {collectionViewMode !== "grid" && canUseMissingSelection && (
            <Button variant="primary" disabled={selectedMissingIds.size === 0} onClick={() => setConfirmBatchMissing(true)}>
              <CheckSquare size={16} />
              Adicionar selecionadas ({selectedMissingIds.size})
            </Button>
          )}
        </div>
      )}

      {isGridLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => (
            <Skeleton key={index} className="h-96" />
          ))}
        </div>
      ) : shouldUseCollectionView && collectionViewMode === "list" ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {collectionDisplayEntries.map((entry) =>
            entry.type === "owned" ? (
              <OwnedCardListRow
                key={`owned-${entry.item.id}`}
                item={entry.item}
                onUpdate={update}
                onRemove={() => setPendingRemove(entry.item)}
                onExport={exportCard}
              />
            ) : (
              <MissingCardListRow
                key={`missing-${entry.card.id}`}
                card={entry.card}
                selected={selectedMissingIds.has(entry.card.id)}
                wished={wishlistIds.has(entry.card.id)}
                quantity={missingQuantities[entry.card.id] ?? 1}
                onSelect={() => toggleSelectedMissing(entry.card.id)}
                onQuantityChange={setMissingQuantity}
                onAdd={addMissing}
                onToggleWishlist={toggleMissingWishlist}
              />
            )
          )}
        </div>
      ) : shouldUseCollectionView && collectionViewMode === "columns" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
          {collectionDisplayEntries.map((entry) =>
            entry.type === "owned" ? (
              <OwnedCompactCard key={`owned-${entry.item.id}`} item={entry.item} onUpdate={update} />
            ) : (
              <MissingCompactCard
                key={`missing-${entry.card.id}`}
                card={entry.card}
                selected={selectedMissingIds.has(entry.card.id)}
                wished={wishlistIds.has(entry.card.id)}
                quantity={missingQuantities[entry.card.id] ?? 1}
                onSelect={() => toggleSelectedMissing(entry.card.id)}
                onQuantityChange={setMissingQuantity}
                onToggleWishlist={toggleMissingWishlist}
              />
            )
          )}
        </div>
      ) : visibleItems.length || visibleMissingCards.length || hasSetOrderedCards ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {hasSetOrderedCards
            ? setOrderedEntries.map((entry) =>
                entry.type === "owned" ? (
                  <CardTile
                    key={entry.item.id}
                    mode="collection"
                    card={entry.item}
                    onUpdate={update}
                    onRemove={() => setPendingRemove(entry.item)}
                    onExport={exportCard}
                  />
                ) : (
                  <MissingCard
                    key={`missing-${entry.card.id}`}
                    card={entry.card}
                    wished={wishlistIds.has(entry.card.id)}
                    active={activeMissingIds.has(entry.card.id)}
                    quantity={missingQuantities[entry.card.id] ?? 1}
                    onHoverActivate={markMissingAsActive}
                    onQuantityChange={setMissingQuantity}
                    onAdd={addMissing}
                    onToggleWishlist={toggleMissingWishlist}
                  />
                )
              )
            : (
                <>
                  {visibleItems.map((item) => (
                    <CardTile key={item.id} mode="collection" card={item} onUpdate={update} onRemove={() => setPendingRemove(item)} onExport={exportCard} />
                  ))}
                  {!tradeOnly &&
                    visibleMissingCards.map((card) => (
                      <MissingCard
                        key={`missing-${card.id}`}
                        card={card}
                        wished={wishlistIds.has(card.id)}
                        active={activeMissingIds.has(card.id)}
                        quantity={missingQuantities[card.id] ?? 1}
                        onHoverActivate={markMissingAsActive}
                        onQuantityChange={setMissingQuantity}
                        onAdd={addMissing}
                        onToggleWishlist={toggleMissingWishlist}
                      />
                    ))}
                </>
              )}
        </div>
      ) : (
        <EmptyState
          title={tradeOnly ? "Nenhuma carta para troca" : "Coleção vazia"}
          description={tradeOnly ? "Marque cartas como troca para visualizá-las aqui." : "Explore cartas e adicione os primeiros itens à sua coleção local."}
        />
      )}
      <Modal title="Adicionar cartas faltantes" open={confirmBatchMissing} onClose={() => setConfirmBatchMissing(false)}>
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Deseja adicionar {selectedMissingCards.length} carta(s) faltante(s), somando {totalSelectedMissingCopies} cópia(s), à sua coleção?
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmBatchMissing(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={() => void addSelectedMissing()}>
              Adicionar selecionadas
            </Button>
          </div>
        </div>
      </Modal>
      <Modal title="Remover carta" open={Boolean(pendingRemove)} onClose={() => setPendingRemove(null)}>
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">Deseja realmente remover esta carta da sua coleção?</p>
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

async function loadSetCards(setId: string): Promise<ExploreCard[]> {
  const pageSize = 500;
  const firstPage = await apiService.cards({ page: 1, pageSize, set: setId, sort: "numberAsc" });
  const totalPages = Math.max(1, Math.ceil(firstPage.totalCount / pageSize));
  if (totalPages === 1) return firstPage.cards;

  const remainingPages = Array.from({ length: totalPages - 1 }, (_, index) => index + 2);
  const results = await Promise.allSettled(remainingPages.map((page) => apiService.cards({ page, pageSize, set: setId, sort: "numberAsc" })));
  const loadedCards = results.flatMap((result) => (result.status === "fulfilled" ? result.value.cards : []));
  return [...firstPage.cards, ...loadedCards];
}

function CollectionModeButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Grid3X3; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
        active ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-900"
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}

function QuantityStepper({
  cardId,
  quantity,
  onQuantityChange
}: {
  cardId: string;
  quantity: number;
  onQuantityChange: (cardId: string, quantity: number) => void;
}) {
  return (
    <div className="flex h-10 items-center overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <button
        type="button"
        className="flex h-10 w-9 items-center justify-center text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        onClick={() => onQuantityChange(cardId, Math.max(1, quantity - 1))}
        aria-label="Diminuir quantidade"
      >
        -
      </button>
      <span className="flex h-10 min-w-10 items-center justify-center border-x border-slate-200 text-sm font-semibold text-slate-900 dark:border-slate-700 dark:text-white">
        {quantity}
      </span>
      <button
        type="button"
        className="flex h-10 w-9 items-center justify-center text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        onClick={() => onQuantityChange(cardId, quantity + 1)}
        aria-label="Aumentar quantidade"
      >
        +
      </button>
    </div>
  );
}

function MissingCardListRow({
  card,
  selected,
  wished,
  quantity,
  onSelect,
  onQuantityChange,
  onAdd,
  onToggleWishlist
}: {
  card: ExploreCard;
  selected: boolean;
  wished: boolean;
  quantity: number;
  onSelect: () => void;
  onQuantityChange: (cardId: string, quantity: number) => void;
  onAdd: (card: ExploreCard, quantity?: number) => void;
  onToggleWishlist: (card: ExploreCard) => void;
}) {
  return (
    <div className="grid grid-cols-[auto_52px_1fr_auto] items-center gap-3 border-b border-slate-100 p-3 last:border-b-0 dark:border-slate-800">
      <input type="checkbox" checked={selected} onChange={onSelect} className="h-4 w-4 rounded border-slate-300 text-indigo-600" aria-label={`Selecionar ${card.name}`} />
      <img src={card.image} alt={card.name} loading="lazy" className="h-16 w-12 rounded-md object-contain grayscale" />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{cardDisplayName(card.name, card.number, card.id)}</p>
        <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">
          {card.set} - {cardDisplayNumber(card.number, card.id)}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{card.marketPrice === null ? "Preço N/D" : `Preço sugerido ${currency(card.marketPrice)}`}</p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button type="button" onClick={() => onToggleWishlist(card)} className={wished ? "text-rose-500" : "text-slate-400 hover:text-rose-500"} aria-label="Lista de desejos">
          <Heart size={18} fill={wished ? "currentColor" : "none"} />
        </button>
        <QuantityStepper cardId={card.id} quantity={quantity} onQuantityChange={onQuantityChange} />
        <Button variant="secondary" size="sm" onClick={() => onAdd(card, quantity)}>
          <Plus size={16} />
          Adicionar
        </Button>
      </div>
    </div>
  );
}

function OwnedQuantityStepper({ quantity, onChange }: { quantity: number; onChange: (quantity: number) => void }) {
  return (
    <div className="flex h-10 items-center overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <button
        type="button"
        className="flex h-10 w-9 items-center justify-center text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        onClick={() => onChange(Math.max(1, quantity - 1))}
        aria-label="Diminuir quantidade"
      >
        -
      </button>
      <span className="flex h-10 min-w-10 items-center justify-center border-x border-slate-200 text-sm font-semibold text-slate-900 dark:border-slate-700 dark:text-white">
        {quantity}
      </span>
      <button
        type="button"
        className="flex h-10 w-9 items-center justify-center text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        onClick={() => onChange(quantity + 1)}
        aria-label="Aumentar quantidade"
      >
        +
      </button>
    </div>
  );
}

function OwnedCardListRow({
  item,
  onUpdate,
  onRemove,
  onExport
}: {
  item: CollectionItem;
  onUpdate: (id: number, data: Partial<Pick<CollectionItem, "quantity" | "price" | "favorite" | "forTrade">>) => void;
  onRemove: () => void;
  onExport: (cardId: string) => void;
}) {
  const repeated = Math.max(0, item.quantity - 1);
  return (
    <div className="grid grid-cols-[52px_1fr_auto] items-center gap-3 border-b border-slate-100 p-3 last:border-b-0 dark:border-slate-800">
      <img src={item.image} alt={item.name} loading="lazy" className="h-16 w-12 rounded-md object-contain" />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{cardDisplayName(item.name, item.number, item.cardId)}</p>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
            Possuída
          </span>
          {repeated > 0 && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
              {repeated} repetida(s)
            </span>
          )}
        </div>
        <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">
          {item.set} - {cardDisplayNumber(item.number, item.cardId)}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">Total no fichário {currency(item.price * item.quantity)}</p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <OwnedQuantityStepper quantity={item.quantity} onChange={(quantity) => onUpdate(item.id, { quantity })} />
        <Button variant={item.favorite ? "primary" : "secondary"} size="sm" onClick={() => onUpdate(item.id, { favorite: !item.favorite })}>
          Favorita
        </Button>
        <Button variant={item.forTrade ? "primary" : "secondary"} size="sm" onClick={() => onUpdate(item.id, { forTrade: !item.forTrade })}>
          Troca
        </Button>
        <Button variant="secondary" size="sm" onClick={() => onExport(item.cardId)}>
          <Download size={16} />
        </Button>
        <Button variant="danger" size="sm" onClick={onRemove}>
          <Trash2 size={16} />
        </Button>
      </div>
    </div>
  );
}

function OwnedCompactCard({
  item,
  onUpdate
}: {
  item: CollectionItem;
  onUpdate: (id: number, data: Partial<Pick<CollectionItem, "quantity" | "price" | "favorite" | "forTrade">>) => void;
}) {
  const repeated = Math.max(0, item.quantity - 1);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">x{item.quantity}</span>
        {repeated > 0 && <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-300">{repeated} rep.</span>}
      </div>
      <img src={item.image} alt={item.name} loading="lazy" className="mx-auto h-24 w-full rounded-md object-contain" />
      <p className="mt-2 line-clamp-2 min-h-8 text-xs font-semibold text-slate-950 dark:text-white">{cardDisplayName(item.name, item.number, item.cardId)}</p>
      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{cardDisplayNumber(item.number, item.cardId)}</p>
      <div className="mt-2 flex scale-90 justify-center">
        <OwnedQuantityStepper quantity={item.quantity} onChange={(quantity) => onUpdate(item.id, { quantity })} />
      </div>
    </div>
  );
}

function MissingCompactCard({
  card,
  selected,
  wished,
  quantity,
  onSelect,
  onQuantityChange,
  onToggleWishlist
}: {
  card: ExploreCard;
  selected: boolean;
  wished: boolean;
  quantity: number;
  onSelect: () => void;
  onQuantityChange: (cardId: string, quantity: number) => void;
  onToggleWishlist: (card: ExploreCard) => void;
}) {
  return (
    <div className={`rounded-xl border bg-white p-2 shadow-sm transition hover:shadow-md dark:bg-slate-900 ${selected ? "border-indigo-400 ring-2 ring-indigo-500/20" : "border-slate-200 dark:border-slate-800"}`}>
      <div className="mb-2 flex items-center justify-between">
        <input type="checkbox" checked={selected} onChange={onSelect} className="h-4 w-4 rounded border-slate-300 text-indigo-600" aria-label={`Selecionar ${card.name}`} />
        <button type="button" onClick={() => onToggleWishlist(card)} className={wished ? "text-rose-500" : "text-slate-400 hover:text-rose-500"} aria-label="Lista de desejos">
          <Heart size={16} fill={wished ? "currentColor" : "none"} />
        </button>
      </div>
      <img src={card.image} alt={card.name} loading="lazy" className="mx-auto h-24 w-full rounded-md object-contain grayscale" />
      <p className="mt-2 line-clamp-2 min-h-8 text-xs font-semibold text-slate-950 dark:text-white">{cardDisplayName(card.name, card.number, card.id)}</p>
      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{cardDisplayNumber(card.number, card.id)}</p>
      <div className="mt-2 flex scale-90 justify-center">
        <QuantityStepper cardId={card.id} quantity={quantity} onQuantityChange={onQuantityChange} />
      </div>
    </div>
  );
}

function MissingCard({
  card,
  wished,
  active,
  quantity,
  onHoverActivate,
  onQuantityChange,
  onAdd,
  onToggleWishlist
}: {
  card: ExploreCard;
  wished: boolean;
  active: boolean;
  quantity: number;
  onHoverActivate: (cardId: string) => void;
  onQuantityChange: (cardId: string, quantity: number) => void;
  onAdd: (card: ExploreCard, quantity?: number) => void;
  onToggleWishlist: (card: ExploreCard) => void;
}) {
  return (
    <article
      onMouseEnter={() => onHoverActivate(card.id)}
      className={`overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:opacity-100 hover:grayscale-0 dark:border-slate-800 dark:bg-slate-900 ${
        active ? "opacity-100 grayscale-0" : "opacity-75 grayscale"
      }`}
    >
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
          <h3 className="line-clamp-2 min-h-10 text-[15px] font-semibold leading-5 text-slate-950 dark:text-white">{cardDisplayName(card.name, card.number, card.id)}</h3>
          <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{card.set} - {cardDisplayNumber(card.number, card.id)}</p>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950/50">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Preco sugerido</p>
          <strong className="text-lg font-semibold text-slate-950 dark:text-white">{card.marketPrice === null ? "N/D" : currency(card.marketPrice)}</strong>
        </div>
        <div className="flex items-center gap-2">
          <QuantityStepper cardId={card.id} quantity={quantity} onQuantityChange={onQuantityChange} />
          <Button className="flex-1" variant="secondary" onClick={() => onAdd(card, quantity)}>
            <Plus size={16} />
            Adicionar
          </Button>
        </div>
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

function normalizeCardName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function matchOwnedCards(cards: ExploreCard[], ownedItems: CollectionItem[]): Map<string, CollectionItem> {
  const matched = new Map<string, CollectionItem>();
  const usedItemIds = new Set<number>();
  const directById = new Map(ownedItems.map((item) => [item.cardId, item]));

  cards.forEach((card) => {
    const direct = directById.get(card.id);
    if (!direct) return;
    matched.set(card.id, direct);
    usedItemIds.add(direct.id);
  });

  const remainingByName = new Map<string, CollectionItem[]>();
  ownedItems.forEach((item) => {
    if (usedItemIds.has(item.id)) return;
    const key = `${normalizeSetName(item.set)}|${normalizeCardName(item.name)}`;
    const entries = remainingByName.get(key) ?? [];
    entries.push(item);
    remainingByName.set(key, entries);
  });

  cards.forEach((card) => {
    if (matched.has(card.id)) return;
    const key = `${normalizeSetName(card.set)}|${normalizeCardName(card.name)}`;
    const candidates = remainingByName.get(key);
    const fallback = candidates?.shift();
    if (fallback) matched.set(card.id, fallback);
  });

  return matched;
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
      const officialTotal = apiSet?.total ?? apiSet?.printedTotal ?? null;
      const totalValue = realCollectionTotal(setItems.map((item) => item.number), officialTotal);
      const total = totalValue > 0 ? totalValue : null;
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
        missingLabel: total ? `${Math.max(total - owned, 0)} faltantes` : "Total não informado"
      };
    })
    .sort((a, b) => b.percent - a.percent || b.owned - a.owned || a.name.localeCompare(b.name));
}

function matchesCollectionFilters(item: CollectionItem, selectedSet: string, favoriteOnly: boolean, tradeOnly: boolean): boolean {
  if (selectedSet && normalizeSetName(item.set) !== normalizeSetName(selectedSet)) return false;
  if (favoriteOnly && !item.favorite) return false;
  if (tradeOnly && !item.forTrade) return false;
  return true;
}

function sortCollectionItems(items: CollectionItem[], sort: "name" | "price" | "quantity" | "numberAsc" | "numberDesc"): CollectionItem[] {
  const next = [...items];
  if (sort === "price") return next.sort((a, b) => b.price - a.price || a.name.localeCompare(b.name));
  if (sort === "quantity") return next.sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name));
  if (sort === "numberAsc" || sort === "numberDesc") {
    const direction = sort === "numberDesc" ? -1 : 1;
    return next.sort((a, b) => {
      const diff = cardNumberValue(a.number) - cardNumberValue(b.number);
      if (diff !== 0) return diff * direction;
      return a.name.localeCompare(b.name);
    });
  }
  return next.sort((a, b) => a.name.localeCompare(b.name));
}

function upsertCollectionItem(items: CollectionItem[], item: CollectionItem, sort: "name" | "price" | "quantity" | "numberAsc" | "numberDesc"): CollectionItem[] {
  const existingIndex = items.findIndex((entry) => entry.id === item.id);
  const next = existingIndex >= 0 ? items.map((entry) => (entry.id === item.id ? item : entry)) : [...items, item];
  return sortCollectionItems(next, sort);
}

function cardNumberValue(number?: string | null): number {
  const parsed = Number(number?.match(/\d+/)?.[0] ?? Number.MAX_SAFE_INTEGER);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 2000);
}

async function extractDownloadErrorMessage(error: unknown): Promise<string> {
  const fallback = "Nao foi possivel concluir o download do PDF agora.";
  if (typeof error !== "object" || !error) return fallback;

  const response = (error as { response?: { data?: unknown } }).response;
  if (!response?.data) return fallback;

  const data = response.data;
  if (data instanceof Blob) {
    try {
      const text = await data.text();
      const parsed = JSON.parse(text) as { message?: string };
      if (parsed.message) return parsed.message;
    } catch {
      return fallback;
    }
  }

  if (typeof data === "object" && data && "message" in data) {
    const message = (data as { message?: string }).message;
    if (message) return message;
  }

  return fallback;
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



