import { CheckSquare, ChevronLeft, ChevronRight, Columns3, FilterX, Grid3X3, Heart, List, Search, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CardTile } from "../components/CardTile";
import { EmptyState } from "../components/EmptyState";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Skeleton } from "../components/ui/Skeleton";
import { Modal } from "../components/ui/Modal";
import { useDebounce } from "../hooks/useDebounce";
import { apiService } from "../services/api";
import type { ExploreCard, ExploreSortOption, PokemonSet } from "../types";
import type { ToastState } from "../components/ui/Toast";

export function Explore({ onToast }: { onToast: (toast: ToastState) => void }) {
  const [cards, setCards] = useState<ExploreCard[]>([]);
  const [sets, setSets] = useState<PokemonSet[]>([]);
  const [search, setSearch] = useState("");
  const [series, setSeries] = useState("");
  const [setId, setSetId] = useState("");
  const [sort, setSort] = useState<ExploreSortOption>("numberAsc");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"grid" | "list" | "columns">("grid");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmBatch, setConfirmBatch] = useState(false);
  const debouncedSearch = useDebounce(search);
  const pageSize = 24;
  const filteredSets = useMemo(
    () => (series ? sets.filter((set) => set.series === series) : sets),
    [series, sets]
  );
  const seriesOptions = useMemo(() => Array.from(new Set(sets.map((set) => set.series).filter(Boolean))).sort(), [sets]);
  const selectedSet = useMemo(() => sets.find((set) => set.id === setId), [setId, sets]);
  const collectionSuggestions = useMemo(() => {
    const query = normalizeText(search);
    if (query.length < 1) return [];

    const compactQuery = query.replace(/\s+/g, "");
    return filteredSets
      .filter((set) => {
        const code = normalizeText(setDisplayCode(set));
        const id = normalizeText(set.id);
        const name = normalizeText(set.name);
        const compactName = name.replace(/\s+/g, "");

        return (
          code.startsWith(compactQuery) ||
          id.startsWith(compactQuery) ||
          name.includes(query) ||
          compactName.includes(compactQuery)
        );
      })
      .slice(0, 8);
  }, [filteredSets, search]);
  const hasFilters = Boolean(search || setId || series || sort !== "numberAsc");

  useEffect(() => {
    let active = true;
    void apiService
      .sets()
      .then((data) => {
        if (active) setSets(data);
      })
      .catch(() => {
        if (active) {
          setSets([]);
          onToast({ type: "error", message: "Nao foi possivel carregar colecoes." });
        }
      });

    return () => {
      active = false;
    };
  }, [onToast]);

  useEffect(() => {
    let active = true;
    void apiService
      .wishlist()
      .then((items) => {
        if (active) setWishlistIds(new Set(items.map((item) => item.cardId)));
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void apiService
      .cards({ page, pageSize, search: debouncedSearch || undefined, set: setId || undefined, sort })
      .then((result) => {
        if (!active) return;
        setCards(result.cards);
        setTotal(result.totalCount);
      })
      .catch(() => {
        if (active) {
          setCards([]);
          setTotal(0);
          onToast({ type: "error", message: "Falha ao buscar cartas Pokemon." });
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [debouncedSearch, onToast, page, setId, sort]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total]);

  function clearFilters() {
    setSearch("");
    setSeries("");
    setSetId("");
    setSort("numberAsc");
    setPage(1);
  }

  function chooseCollection(set: PokemonSet) {
    setSetId(set.id);
    setSearch("");
    setPage(1);
  }

  function setCardQuantity(cardId: string, quantity: number) {
    setQuantities((current) => ({ ...current, [cardId]: Math.max(1, quantity) }));
  }

  async function add(card: ExploreCard, quantity = quantities[card.id] ?? 1) {
    try {
      await apiService.addToCollection(card, quantity);
      onToast({ type: "success", message: `${quantity} copia(s) adicionada(s) a colecao.` });
    } catch {
      onToast({ type: "error", message: "Nao foi possivel adicionar esta carta." });
    }
  }

  async function toggleWishlist(card: ExploreCard) {
    const wished = wishlistIds.has(card.id);
    setWishlistIds((current) => {
      const next = new Set(current);
      if (wished) next.delete(card.id);
      else next.add(card.id);
      return next;
    });

    try {
      if (wished) {
        await apiService.removeWishlist(card.id);
        onToast({ type: "success", message: "Carta removida da lista de desejos." });
      } else {
        await apiService.addWishlist(card);
        onToast({ type: "success", message: "Carta adicionada a lista de desejos." });
      }
    } catch {
      setWishlistIds((current) => {
        const next = new Set(current);
        if (wished) next.add(card.id);
        else next.delete(card.id);
        return next;
      });
      onToast({ type: "error", message: "Nao foi possivel atualizar a lista de desejos." });
    }
  }

  function toggleSelected(cardId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  }

  async function addSelected() {
    const selectedCards = cards.filter((card) => selectedIds.has(card.id));
    try {
      await Promise.all(selectedCards.map((card) => apiService.addToCollection(card, quantities[card.id] ?? 1)));
      onToast({ type: "success", message: `${selectedCards.length} carta(s) adicionada(s) a colecao.` });
      setSelectedIds(new Set());
      setConfirmBatch(false);
    } catch {
      onToast({ type: "error", message: "Nao foi possivel adicionar as cartas selecionadas." });
    }
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">Explorar cartas</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">Marketplace de cartas</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Pesquise por nome, serie ou colecao e adicione direto na sua pasta.</p>
          </div>
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">{total.toLocaleString("pt-BR")} cartas</span>
        </div>
        </div>
        <div className="space-y-3 p-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_190px_260px_220px_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 text-muted-foreground" size={16} />
              <Input
                className="pl-9"
                placeholder="Buscar carta ou colecao, ex: Charizard, ASC, Surging Sparks"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </div>
            <Select
              value={series}
              onChange={(event) => {
                setSeries(event.target.value);
                setSetId("");
                setPage(1);
              }}
            >
              <option value="">Todas as series</option>
              {seriesOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
            <Select
              value={setId}
              onChange={(event) => {
                setSetId(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Todas as colecoes</option>
              {filteredSets.map((set) => (
                <option key={set.id} value={set.id}>
                  {setDisplayCode(set)} - {set.name}
                </option>
              ))}
            </Select>
            <Select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as ExploreSortOption);
                setPage(1);
              }}
            >
              <option value="numberAsc">Numero: menor para maior</option>
              <option value="numberDesc">Numero: maior para menor</option>
              <option value="name">Nome A-Z</option>
            </Select>
            <Button variant="secondary" disabled={!hasFilters} onClick={clearFilters}>
              <FilterX size={16} />
              Limpar
            </Button>
          </div>
          {collectionSuggestions.length > 0 && !setId && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-3 dark:border-indigo-900/60 dark:bg-indigo-950/20">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-200">Colecoes encontradas</p>
                <span className="text-xs font-medium text-indigo-600 dark:text-indigo-300">clique para filtrar</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {collectionSuggestions.map((set) => (
                  <button
                    key={set.id}
                    type="button"
                    onClick={() => chooseCollection(set)}
                    className="rounded-lg border border-white bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="rounded-md bg-slate-950 px-2 py-1 text-xs font-semibold text-white dark:bg-indigo-600">{setDisplayCode(set)}</span>
                      <span className="text-xs font-semibold text-slate-500">{set.printedTotal ?? set.total ?? "?"} cartas</span>
                    </div>
                    <p className="mt-2 line-clamp-1 text-sm font-semibold text-slate-950 dark:text-white">{set.name}</p>
                    <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">ID oficial: {set.id}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
          {selectedSet && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Colecao filtrada</p>
                <p className="text-sm font-semibold text-slate-950 dark:text-white">
                  {setDisplayCode(selectedSet)} - {selectedSet.name}
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setSetId("")}>
                Remover colecao
              </Button>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {["ASC", "SSP", "Prismatic Evolutions", "charizard", "pikachu"].map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => {
                  setSearch(term);
                  setPage(1);
                }}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-indigo-200 hover:bg-white hover:text-indigo-600 hover:shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-900"
              >
                <Sparkles size={12} />
                {term}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="flex items-center gap-1">
              <ModeButton active={viewMode === "grid"} onClick={() => setViewMode("grid")} icon={Grid3X3} label="Grid" />
              <ModeButton active={viewMode === "list"} onClick={() => setViewMode("list")} icon={List} label="Lista" />
              <ModeButton active={viewMode === "columns"} onClick={() => setViewMode("columns")} icon={Columns3} label="Colunas" />
            </div>
            {viewMode !== "grid" && (
              <Button variant="primary" disabled={selectedIds.size === 0} onClick={() => setConfirmBatch(true)}>
                <CheckSquare size={16} />
                Adicionar selecionadas ({selectedIds.size})
              </Button>
            )}
          </div>
        </div>
      </section>

      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {Array.from({ length: 12 }).map((_, index) => (
            <Skeleton key={index} className="h-80" />
          ))}
        </div>
      ) : cards.length && viewMode === "grid" ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {cards.map((card) => (
            <CardTile
              key={card.id}
              mode="explore"
              card={card}
              quantity={quantities[card.id] ?? 1}
              wished={wishlistIds.has(card.id)}
              onQuantityChange={setCardQuantity}
              onToggleWishlist={toggleWishlist}
              onAdd={add}
            />
          ))}
        </div>
      ) : cards.length && viewMode === "list" ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {cards.map((card) => (
            <CardListRow
              key={card.id}
              card={card}
              selected={selectedIds.has(card.id)}
              wished={wishlistIds.has(card.id)}
              quantity={quantities[card.id] ?? 1}
              onSelect={() => toggleSelected(card.id)}
              onQuantityChange={setCardQuantity}
              onToggleWishlist={toggleWishlist}
            />
          ))}
        </div>
      ) : cards.length && viewMode === "columns" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
          {cards.map((card) => (
            <CompactCard
              key={card.id}
              card={card}
              selected={selectedIds.has(card.id)}
              wished={wishlistIds.has(card.id)}
              onSelect={() => toggleSelected(card.id)}
              onToggleWishlist={toggleWishlist}
            />
          ))}
        </div>
      ) : (
        <EmptyState title="Nenhuma carta encontrada" description="Ajuste a busca ou remova filtros para ver mais resultados." />
      )}

      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 shadow-sm  dark:border-slate-800 dark:bg-slate-900/80">
        <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
          <ChevronLeft size={16} />
          Anterior
        </Button>
        <span className="text-sm text-muted-foreground">
          Pagina {page} de {totalPages}
        </span>
        <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>
          Proxima
          <ChevronRight size={16} />
        </Button>
      </div>

      <Modal title="Adicionar cartas selecionadas" open={confirmBatch} onClose={() => setConfirmBatch(false)}>
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">Deseja adicionar {selectedIds.size} cartas a sua colecao?</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmBatch(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={() => void addSelected()}>
              Adicionar selecionadas
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ModeButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Grid3X3; label: string }) {
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

function CardListRow({
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
    <div className="grid grid-cols-[auto_52px_1fr_auto] items-center gap-3 border-b border-slate-100 p-3 last:border-b-0 dark:border-slate-800">
      <input type="checkbox" checked={selected} onChange={onSelect} className="h-4 w-4 rounded border-slate-300 text-indigo-600" aria-label={`Selecionar ${card.name}`} />
      <img src={card.image} alt={card.name} loading="lazy" className="h-16 w-12 rounded-md object-contain" />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{card.name}</p>
        <p className="truncate text-xs font-medium text-slate-500">{card.set} - #{card.number ?? "N/D"}</p>
        <p className="text-xs text-slate-500">{card.rarity ?? "Raridade nao informada"}</p>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onToggleWishlist(card)} className={wished ? "text-rose-500" : "text-slate-400 hover:text-rose-500"} aria-label="Lista de desejos">
          <Heart size={18} fill={wished ? "currentColor" : "none"} />
        </button>
        <div className="flex items-center overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
          <button className="h-8 w-8" onClick={() => onQuantityChange(card.id, Math.max(1, quantity - 1))}>-</button>
          <span className="min-w-8 text-center text-sm font-semibold">{quantity}</span>
          <button className="h-8 w-8" onClick={() => onQuantityChange(card.id, quantity + 1)}>+</button>
        </div>
      </div>
    </div>
  );
}

function CompactCard({
  card,
  selected,
  wished,
  onSelect,
  onToggleWishlist
}: {
  card: ExploreCard;
  selected: boolean;
  wished: boolean;
  onSelect: () => void;
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
      <img src={card.image} alt={card.name} loading="lazy" className="mx-auto h-24 w-full rounded-md object-contain" />
      <p className="mt-2 line-clamp-2 min-h-8 text-xs font-semibold text-slate-950 dark:text-white">{card.name}</p>
      <p className="text-[11px] font-medium text-slate-500">#{card.number ?? "N/D"}</p>
    </div>
  );
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}.]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function setDisplayCode(set: PokemonSet): string {
  return (set.ptcgoCode || set.id).toUpperCase();
}



