import { Activity, Database, Tags, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Skeleton } from "../components/ui/Skeleton";
import { apiService } from "../services/api";
import type { AdminOverview } from "../types";
import { currency } from "../lib/utils";

export function Admin() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);

  useEffect(() => {
    void apiService.adminOverview().then(setOverview);
  }, []);

  if (!overview) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">Admin</p>
        <h2 className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">Saude do sistema</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Resumo operacional de usuarios, cache e precificacao.</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetric icon={Users} label="Usuarios" value={overview.users} />
        <AdminMetric icon={Tags} label="Cartas na colecao" value={overview.collectionCards} />
        <AdminMetric icon={Database} label="Cache cartas/sets" value={`${overview.cachedCards}/${overview.cachedSets}`} />
        <AdminMetric icon={Activity} label="Historico de precos" value={overview.priceRows} />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-lg font-semibold text-slate-950 dark:text-white">Ultimos precos registrados</h3>
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
          {overview.latestPrices.length ? overview.latestPrices.map((price) => (
            <div key={price.id} className="grid gap-2 border-b border-slate-100 p-3 text-sm last:border-b-0 md:grid-cols-[1fr_160px_120px_120px] dark:border-slate-800">
              <div>
                <p className="font-semibold text-slate-950 dark:text-white">{price.cardName}</p>
                <p className="text-xs text-slate-500">{price.collectionName}</p>
              </div>
              <span className="font-semibold text-indigo-600 dark:text-indigo-300">{currency(price.estimatedPrice)}</span>
              <span className="text-slate-500">{price.source}</span>
              <span className="text-slate-500">{price.confidence}</span>
            </div>
          )) : <p className="p-4 text-sm text-slate-500">Nenhum preco registrado ainda.</p>}
        </div>
      </section>
    </div>
  );
}

function AdminMetric({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">
        <Icon size={18} />
      </div>
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}
