import { create } from "zustand";
import type { AuthUser, SortOption } from "../types";

type View = "dashboard" | "explore" | "collection" | "trades";

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
  setView: (view: View) => void;
  setFilters: (filters: Partial<PersistedFilters>) => void;
  setAuth: (token: string, user: AuthUser) => void;
  logout: () => void;
};

const storageKey = "pokemon-tcg-local-filters";
const tokenKey = "pokemon-tcg-token";
const userKey = "pokemon-tcg-user";

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
  view: "explore",
  filters: loadFilters(),
  token: localStorage.getItem(tokenKey),
  user: loadUser(),
  setView: (view) => set({ view }),
  setFilters: (filters) =>
    set((state) => {
      const next = { ...state.filters, ...filters };
      localStorage.setItem(storageKey, JSON.stringify(next));
      return { filters: next };
    }),
  setAuth: (token, user) => {
    localStorage.setItem(tokenKey, token);
    localStorage.setItem(userKey, JSON.stringify(user));
    set({ token, user });
  },
  logout: () => {
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(userKey);
    set({ token: null, user: null, view: "explore" });
  }
}));
