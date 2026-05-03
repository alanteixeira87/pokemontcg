import { ChevronLeft, ChevronRight, FilterX, Search, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CardTile } from "../components/CardTile";
import { EmptyState } from "../components/EmptyState";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Skeleton } from "../components/ui/Skeleton";
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
    void apiService.sets().then(setSets).catch(() => onToast({ type: "error", message: "Nao foi possivel carregar colecoes." }));
  }, [onToast]);

  useEffect(() => {
    setLoading(true);
    void apiService
      .cards({ page, pageSize, search: debouncedSearch || undefined, set: setId || undefined, sort })
      .then((result) => {
        setCards(result.cards);
        setTotal(result.totalCount);
      })
      .catch(() => onToast({ type: "error", message: "Falha ao buscar cartas Pokemon." }))
      .finally(() => setLoading(false));
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

  async function add(card: ExploreCard) {
    try {
      await apiService.addToCollection(card);
      onToast({ type: "success", message: "Carta adicionada a colecao." });
    } catch {
      onToast({ type: "error", message: "Nao foi possivel adicionar esta carta." });
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
        </div>
      </section>

      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {Array.from({ length: 12 }).map((_, index) => (
            <Skeleton key={index} className="h-80" />
          ))}
        </div>
      ) : cards.length ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {cards.map((card) => (
            <CardTile key={card.id} mode="explore" card={card} onAdd={add} />
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



