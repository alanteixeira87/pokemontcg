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
                  {set.name}
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



