import { create } from "zustand";
import type { AuthUser, SortOption } from "../types";

export type View = "dashboard" | "explore" | "collection" | "trades";

type PersistedFilters = {
  set: string;
  favorite: boolean;
  forTrade: boolean;
  sort: SortOption;
};

type AppState = {
  view: View;
  filters: PersistedFilters;
  token: string | null;
  user: AuthUser | null;
  theme: "light" | "dark";
  setView: (view: View) => void;
  setFilters: (filters: Partial<PersistedFilters>) => void;
  toggleTheme: () => void;
  setAuth: (token: string, user: AuthUser) => void;
  logout: () => void;
};

const storageKey = "pokemon-tcg-local-filters";
const tokenKey = "pokemon-tcg-token";
const userKey = "pokemon-tcg-user";
const themeKey = "pokemon-tcg-theme";
const viewKey = "pokemon-tcg-view";
const validViews: View[] = ["dashboard", "explore", "collection", "trades"];

function isView(value: string | null): value is View {
  return Boolean(value && validViews.includes(value as View));
}

function readHashView(): View | null {
  const value = window.location.hash.replace(/^#\/?/, "");
  return isView(value) ? value : null;
}

function loadView(): View {
  return readHashView() ?? (isView(localStorage.getItem(viewKey)) ? localStorage.getItem(viewKey) as View : "explore");
}

function persistView(view: View) {
  localStorage.setItem(viewKey, view);
  const nextHash = `#/${view}`;
  if (window.location.hash !== nextHash) {
    window.history.pushState(null, "", nextHash);
  }
}

function loadFilters(): PersistedFilters {
  const fallback: PersistedFilters = { set: "", favorite: false, forTrade: false, sort: "numberAsc" };
  const raw = localStorage.getItem(storageKey);
  if (!raw) return fallback;
  try {
    return { ...fallback, ...JSON.parse(raw) } as PersistedFilters;
  } catch {
    return fallback;
  }
}

function loadUser(): AuthUser | null {
  const raw = localStorage.getItem(userKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export const useAppStore = create<AppState>((set) => ({
  view: loadView(),
  filters: loadFilters(),
  token: localStorage.getItem(tokenKey),
  user: loadUser(),
  theme: localStorage.getItem(themeKey) === "dark" ? "dark" : "light",
  setView: (view) => {
    persistView(view);
    set({ view });
  },
  setFilters: (filters) =>
    set((state) => {
      const next = { ...state.filters, ...filters };
      localStorage.setItem(storageKey, JSON.stringify(next));
      return { filters: next };
    }),
  toggleTheme: () =>
    set((state) => {
      const theme = state.theme === "dark" ? "light" : "dark";
      localStorage.setItem(themeKey, theme);
      return { theme };
    }),
  setAuth: (token, user) => {
    localStorage.setItem(tokenKey, token);
    localStorage.setItem(userKey, JSON.stringify(user));
    set({ token, user });
  },
  logout: () => {
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(userKey);
    localStorage.removeItem(viewKey);
    if (window.location.hash) {
      window.history.pushState(null, "", window.location.pathname + window.location.search);
    }
    set({ token: null, user: null, view: "explore" });
  }
}));
