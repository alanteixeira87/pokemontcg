import { BarChart3, Boxes, HeartHandshake, Library, LogOut, Menu, Search, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { useAppStore } from "../store/useAppStore";
import { Button } from "./ui/Button";

const nav = [
  { id: "explore", label: "Explorar", icon: Library },
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "collection", label: "Minha colecao", icon: Boxes },
  { id: "trades", label: "Trocas", icon: HeartHandshake }
] as const;

export function Layout({ children }: { children: ReactNode }) {
  const { view, setView } = useAppStore();
  const user = useAppStore((state) => state.user);
  const logout = useAppStore((state) => state.logout);

  return (
    <div className="min-h-screen">
      <header className="border-b border-red-800 bg-primary text-white shadow-md">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 md:px-6 lg:flex-row lg:items-center">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase text-red-100">Pokemon TCG</p>
              <h1 className="text-2xl font-black tracking-normal">Colecao Local</h1>
            </div>
            <Button className="lg:hidden" size="icon" variant="ghost" aria-label="Menu">
              <Menu size={20} />
            </Button>
          </div>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-3 text-slate-400" size={17} />
            <input
              readOnly
              value="Busque, organize e importe suas cartas"
              onClick={() => setView("explore")}
              className="h-11 w-full rounded-md border border-red-900/20 bg-white pl-10 pr-3 text-sm font-medium text-slate-600 shadow-inner outline-none"
            />
          </div>
          <div className="hidden items-center gap-2 rounded-md bg-red-900/25 px-3 py-2 text-xs font-semibold lg:flex">
            <ShieldCheck size={16} />
            {user ? user.name : "Conta protegida"}
          </div>
          {user && (
            <Button variant="ghost" className="text-white hover:bg-red-900/25 hover:text-white" onClick={logout}>
              <LogOut size={16} />
              Sair
            </Button>
          )}
        </div>
      </header>

      <div className="border-b border-border bg-white">
        <nav className="mx-auto hidden max-w-7xl items-center gap-1 px-4 py-2 md:px-6 lg:flex">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition ${
                  view === item.id ? "bg-accent text-slate-950" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                }`}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <nav className="grid grid-cols-4 border-t border-border bg-white lg:hidden">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`flex flex-col items-center gap-1 px-2 py-3 text-[11px] font-semibold ${
                  view === item.id ? "bg-yellow-100 text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon size={17} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      <main className="mx-auto max-w-7xl p-4 md:p-6">{children}</main>
    </div>
  );
}
