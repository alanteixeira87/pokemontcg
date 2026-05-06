import { BarChart3, Boxes, Heart, HeartHandshake, Library, LogOut, Menu, Moon, Search, ShieldCheck, SlidersHorizontal, Sun, UserCircle, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useAppStore } from "../store/useAppStore";
import { Button } from "./ui/Button";

const nav = [
  { id: "explore", label: "Explorar", icon: Library },
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "collection", label: "Minha colecao", icon: Boxes },
  { id: "wishlist", label: "Lista de desejos", icon: Heart },
  { id: "trades", label: "Trocas", icon: HeartHandshake },
  { id: "profile", label: "Perfil", icon: UserCircle },
  { id: "admin", label: "Admin", icon: SlidersHorizontal }
] as const;

export function Layout({ children }: { children: ReactNode }) {
  const { view, setView, theme, toggleTheme } = useAppStore();
  const user = useAppStore((state) => state.user);
  const logout = useAppStore((state) => state.logout);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.body.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return (
    <div className="min-h-screen text-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white -md dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex min-h-16 max-w-7xl flex-col gap-3 px-4 py-3 md:px-6 lg:flex-row lg:items-center lg:py-0">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-16 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-transparent shadow-sm dark:border-slate-800">
                <img src="/vlrtcg-logo-transparent.png" alt="VLRTCG" className="h-full w-full object-contain p-1" draggable={false} />
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Pokemon TCG</p>
                <h1 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">VLRTCG</h1>
              </div>
            </div>
            <Button className="lg:hidden" size="icon" variant="ghost" aria-label="Menu" onClick={() => setMobileMenuOpen((open) => !open)}>
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </Button>
          </div>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-3 text-slate-400" size={16} />
            <input
              readOnly
              value="Busque, organize e importe suas cartas"
              onClick={() => setView("explore")}
              className="h-10 w-full cursor-pointer rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-500 outline-none transition hover:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            />
          </div>
          <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 lg:flex dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
            <ShieldCheck size={16} />
            {user ? user.name : "Conta protegida"}
          </div>
          <Button className="hidden lg:inline-flex" variant="secondary" size="icon" onClick={toggleTheme} aria-label="Alternar tema">
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </Button>
          {user && (
            <Button className="hidden lg:inline-flex" variant="ghost" onClick={logout}>
              <LogOut size={16} />
              Sair
            </Button>
          )}
        </div>
      </header>

      <div className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <nav className="mx-auto hidden max-w-7xl flex-wrap items-center gap-1 px-4 py-2 md:px-6 lg:flex">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                  view === item.id
                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
                }`}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>
        {mobileMenuOpen && (
          <div className="border-t border-slate-200 bg-white p-3 shadow-sm lg:hidden dark:border-slate-800 dark:bg-slate-950">
            <nav className="grid gap-1">
              {nav.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setView(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition ${
                      view === item.id ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900"
                    }`}
                  >
                    <Icon size={18} />
                    {item.label}
                  </button>
                );
              })}
              <button
                onClick={toggleTheme}
                className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900"
              >
                {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
                Alternar tema
              </button>
              {user && (
                <button
                  onClick={logout}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/30"
                >
                  <LogOut size={18} />
                  Sair
                </button>
              )}
            </nav>
          </div>
        )}
      </div>

      <main className="mx-auto max-w-7xl p-4 md:p-6">{children}</main>
    </div>
  );
}


