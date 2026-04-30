import { Download, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CardTile } from "../components/CardTile";
import { EmptyState } from "../components/EmptyState";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import { Skeleton } from "../components/ui/Skeleton";
import { apiService } from "../services/api";
import { useAppStore } from "../store/useAppStore";
import type { CollectionItem } from "../types";
import type { ToastState } from "../components/ui/Toast";

export function Collection({ tradeOnly = false, onToast }: { tradeOnly?: boolean; onToast: (toast: ToastState) => void }) {
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [availableSets, setAvailableSets] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const { filters, setFilters } = useAppStore();

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
    if (tradeOnly) return;
    void apiService.collection({ sort: "name" }).then((data) => {
      setAvailableSets(Array.from(new Set(data.map((item) => item.set))).sort());
    });
  }, [items.length, tradeOnly]);

  const sets = useMemo(() => availableSets, [availableSets]);

  async function update(id: number, data: Partial<Pick<CollectionItem, "quantity" | "price" | "favorite" | "forTrade">>) {
    const previous = items;
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...data } : item)));
    try {
      const updated = await apiService.updateCollection(id, data);
      setItems((current) => current.map((item) => (item.id === id ? updated : item)));
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
        <section className="rounded-lg border border-border bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-900">Minha pasta</h2>
              <p className="text-sm text-muted-foreground">Controle quantidade, preco, favoritos e cartas para troca.</p>
            </div>
            <span className="rounded-md bg-yellow-100 px-3 py-1 text-xs font-bold text-slate-900">{items.length} cartas unicas</span>
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
