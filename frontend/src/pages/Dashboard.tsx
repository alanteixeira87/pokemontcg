import { Download, Heart, Package, Repeat2, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { apiService } from "../services/api";
import type { DashboardStats } from "../types";
import { currency } from "../lib/utils";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Package }) {
  return (
    <div className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition duration-150 hover:scale-[1.01] hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">
        <Icon size={20} />
      </div>
      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void apiService
      .dashboard()
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <Skeleton className="h-72 w-full" />;
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">Dashboard</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">Visao geral da colecao</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Valores e contagens calculados a partir da base local.</p>
          </div>
          <Button variant="primary" onClick={() => window.open(apiService.exportUrl("full"), "_blank")}>
            <Download size={16} />
            Exportar Excel
          </Button>
        </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total de cartas" value={stats?.totalCards ?? 0} icon={Package} />
        <StatCard label="Valor total" value={currency(stats?.totalValue ?? 0)} icon={Wallet} />
        <StatCard label="Favoritas" value={stats?.favorites ?? 0} icon={Heart} />
        <StatCard label="Para troca" value={stats?.forTrade ?? 0} icon={Repeat2} />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-950 dark:text-white">Cartas unicas</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Cada carta e armazenada uma unica vez; novas adicoes somam quantidade.</p>
          </div>
          <p className="text-4xl font-semibold text-indigo-600 dark:text-indigo-300">{stats?.uniqueCards ?? 0}</p>
        </div>
      </section>
    </div>
  );
}



