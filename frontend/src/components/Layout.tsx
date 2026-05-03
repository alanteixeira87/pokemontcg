import { BarChart3, Boxes, HeartHandshake, Library, LogOut, Menu, Moon, Search, ShieldCheck, Sun } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useAppStore } from "../store/useAppStore";
import { Button } from "./ui/Button";

const nav = [
  { id: "explore", label: "Explorar", icon: Library },
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "collection", label: "Minha colecao", icon: Boxes },
  { id: "trades", label: "Trocas", icon: HeartHandshake }
] as const;

export function Layout({ children }: { children: ReactNode }) {
  const { view, setView, theme, toggleTheme } = useAppStore();
  const user = useAppStore((state) => state.user);
  const logout = useAppStore((state) => state.logout);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.body.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return (
    <div className="min-h-screen text-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-30 border-b border-white/70 bg-white/82 shadow-[0_10px_35px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 md:px-6 lg:flex-row lg:items-center">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-amber-400 text-lg font-black text-white shadow-[0_12px_28px_rgba(220,38,38,0.25)]">
                P
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-red-600 dark:text-red-300">Pokemon TCG</p>
                <h1 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">Colecao Local</h1>
              </div>
            </div>
            <Button className="lg:hidden" size="icon" variant="ghost" aria-label="Menu">
              <Menu size={20} />
            </Button>
          </div>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-3.5 text-slate-400" size={17} />
            <input
              readOnly
              value="Busque, organize e importe suas cartas"
              onClick={() => setView("explore")}
              className="h-12 w-full cursor-pointer rounded-2xl border border-slate-200 bg-slate-50/80 pl-11 pr-3 text-sm font-semibold text-slate-500 shadow-inner outline-none transition hover:bg-white focus:ring-4 focus:ring-red-500/10 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-900"
            />
          </div>
          <div className="hidden items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm lg:flex dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
            <ShieldCheck size={16} />
            {user ? user.name : "Conta protegida"}
          </div>
          <Button variant="secondary" size="icon" onClick={toggleTheme} aria-label="Alternar tema">
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </Button>
          {user && (
            <Button variant="ghost" onClick={logout}>
              <LogOut size={16} />
              Sair
            </Button>
          )}
        </div>
      </header>

      <div className="border-b border-slate-200 bg-white/70 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/65">
        <nav className="mx-auto hidden max-w-7xl items-center gap-1 px-4 py-2 md:px-6 lg:flex">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all duration-200 ${
                  view === item.id
                    ? "bg-slate-950 text-white shadow-md dark:bg-white dark:text-slate-950"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                }`}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <nav className="grid grid-cols-4 border-t border-slate-200 bg-white/95 lg:hidden dark:border-slate-800 dark:bg-slate-950/95">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`flex flex-col items-center gap-1 px-2 py-3 text-[11px] font-bold transition ${
                  view === item.id ? "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-200" : "text-slate-500 dark:text-slate-400"
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
