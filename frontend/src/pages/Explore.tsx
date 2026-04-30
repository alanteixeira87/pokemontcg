import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CardTile } from "../components/CardTile";
import { EmptyState } from "../components/EmptyState";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Skeleton } from "../components/ui/Skeleton";
import { useDebounce } from "../hooks/useDebounce";
import { apiService } from "../services/api";
import type { ExploreCard, PokemonSet } from "../types";
import type { ToastState } from "../components/ui/Toast";

export function Explore({ onToast }: { onToast: (toast: ToastState) => void }) {
  const [cards, setCards] = useState<ExploreCard[]>([]);
  const [sets, setSets] = useState<PokemonSet[]>([]);
  const [search, setSearch] = useState("");
  const [setId, setSetId] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const debouncedSearch = useDebounce(search);
  const pageSize = 24;

  useEffect(() => {
    void apiService.sets().then(setSets).catch(() => onToast({ type: "error", message: "Nao foi possivel carregar colecoes." }));
  }, [onToast]);

  useEffect(() => {
    setLoading(true);
    void apiService
      .cards({ page, pageSize, search: debouncedSearch || undefined, set: setId || undefined })
      .then((result) => {
        setCards(result.cards);
        setTotal(result.totalCount);
      })
      .catch(() => onToast({ type: "error", message: "Falha ao buscar cartas Pokemon." }))
      .finally(() => setLoading(false));
  }, [debouncedSearch, onToast, page, setId]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total]);

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
      <section className="rounded-lg border border-border bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900">Marketplace de cartas</h2>
            <p className="text-sm text-muted-foreground">Pesquise por nome, filtre por colecao e adicione direto na sua pasta.</p>
          </div>
          <span className="rounded-md bg-yellow-100 px-3 py-1 text-xs font-bold text-slate-900">{total.toLocaleString("pt-BR")} cartas</span>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_260px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3 text-muted-foreground" size={16} />
          <Input
            className="pl-9"
            placeholder="Buscar por nome"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          value={setId}
          onChange={(event) => {
            setSetId(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Todas as colecoes</option>
          {sets.map((set) => (
            <option key={set.id} value={set.id}>
              {set.name}
            </option>
          ))}
        </Select>
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

      <div className="flex items-center justify-between rounded-lg border border-border bg-white p-3 shadow-sm">
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
