import { BarChart3, Download, Layers3, Trophy, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CardTile } from "../components/CardTile";
import { EmptyState } from "../components/EmptyState";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import { Skeleton } from "../components/ui/Skeleton";
import { apiService } from "../services/api";
import { useAppStore } from "../store/useAppStore";
import type { CollectionItem, PokemonSet } from "../types";
import type { ToastState } from "../components/ui/Toast";

export function Collection({ tradeOnly = false, onToast }: { tradeOnly?: boolean; onToast: (toast: ToastState) => void }) {
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [allItems, setAllItems] = useState<CollectionItem[]>([]);
  const [availableSets, setAvailableSets] = useState<string[]>([]);
  const [pokemonSets, setPokemonSets] = useState<PokemonSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
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

  const sets = useMemo(() => availableSets, [availableSets]);
  const collectionSummary = useMemo(() => buildCollectionSummary(allItems, pokemonSets), [allItems, pokemonSets]);
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

  return (
    <div className="space-y-5">
      {!tradeOnly && (
        <section className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-gradient-to-r from-red-700 via-primary to-red-500 p-5 text-white">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase text-red-100">Minha colecao Pokemon TCG</p>
                <h2 className="mt-1 text-2xl font-black">Minha pasta</h2>
                <p className="mt-1 text-sm text-red-50">Acompanhe progresso por colecao, quantidade, favoritos e cartas para troca.</p>
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
              <h3 className="text-lg font-black text-slate-900">Filtros e organizacao</h3>
              <p className="text-sm text-muted-foreground">Controle quantidade, preco, favoritos e cartas para troca.</p>
            </div>
            <span className="rounded-md bg-yellow-100 px-3 py-1 text-xs font-bold text-slate-900">{items.length} cartas no filtro</span>
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
              <h3 className="text-xl font-black text-slate-900">Progresso por colecao</h3>
              <p className="text-sm text-muted-foreground">Cada card mostra quantas cartas unicas voce ja tem naquele set.</p>
            </div>
            <span className="text-sm font-semibold text-slate-500">{collectionSummary.length} colecoes iniciadas</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {collectionSummary.map((set) => (
              <button
                key={set.name}
                type="button"
                onClick={() => setFilters({ set: set.name })}
                className="group rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-glow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="inline-flex rounded-md bg-slate-900 px-2 py-1 text-xs font-black uppercase text-white">
                      {set.code}
                    </span>
                    <h4 className="mt-3 truncate text-base font-black text-slate-950">{set.name}</h4>
                    <p className="mt-1 text-xs font-medium text-slate-500">{set.series || "Serie Pokemon TCG"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-primary">{set.percent}%</p>
                    <p className="text-xs font-semibold text-slate-500">{set.owned}/{set.totalLabel}</p>
                  </div>
                </div>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-yellow-400 transition-all"
                    style={{ width: `${Math.min(set.percent, 100)}%` }}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs font-semibold text-slate-500">
                  <span>{set.missingLabel}</span>
                  <span className="text-primary group-hover:underline">Filtrar set</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        {!tradeOnly && (
          <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-border bg-white px-4 text-sm font-semibold text-foreground shadow-sm transition hover:bg-slate-50">
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
            <CardTile key={item.id} mode="collection" card={item} onUpdate={update} onRemove={remove} onExport={exportCard} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={tradeOnly ? "Nenhuma carta para troca" : "Colecao vazia"}
          description={tradeOnly ? "Marque cartas como troca para visualiza-las aqui." : "Explore cartas e adicione os primeiros itens a sua colecao local."}
        />
      )}
    </div>
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
    <div className="rounded-lg border border-white/15 bg-white/10 p-3 shadow-sm backdrop-blur">
      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-md bg-white text-primary">
        <Icon size={16} />
      </div>
      <p className="text-[11px] font-bold uppercase text-red-50">{label}</p>
      <p className="text-xl font-black text-white">{value}</p>
    </div>
  );
}
