import { Download, Heart, Package, Repeat2, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { apiService } from "../services/api";
import type { DashboardStats } from "../types";
import { currency } from "../lib/utils";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Package }) {
  return (
    <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-yellow-100 text-primary">
        <Icon size={20} />
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-900">{value}</p>
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
      <section className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
        <div className="h-2 bg-primary" />
        <div className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-900">Visao geral da colecao</h2>
            <p className="mt-1 text-sm text-muted-foreground">Valores e contagens calculados a partir da base local.</p>
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

      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Cartas unicas</h3>
            <p className="text-sm text-muted-foreground">Cada carta e armazenada uma unica vez; novas adicoes somam quantidade.</p>
          </div>
          <p className="text-4xl font-black text-primary">{stats?.uniqueCards ?? 0}</p>
        </div>
      </section>
    </div>
  );
}
