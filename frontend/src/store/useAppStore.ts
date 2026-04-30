import { create } from "zustand";
import type { SortOption } from "../types";

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
  setView: (view: View) => void;
  setFilters: (filters: Partial<PersistedFilters>) => void;
};

const storageKey = "pokemon-tcg-local-filters";

function loadFilters(): PersistedFilters {
  const fallback: PersistedFilters = { set: "", favorite: false, forTrade: false, sort: "name" };
  const raw = localStorage.getItem(storageKey);
  if (!raw) return fallback;
  try {
    return { ...fallback, ...JSON.parse(raw) } as PersistedFilters;
  } catch {
    return fallback;
  }
}

export const useAppStore = create<AppState>((set) => ({
  view: "explore",
  filters: loadFilters(),
  setView: (view) => set({ view }),
  setFilters: (filters) =>
    set((state) => {
      const next = { ...state.filters, ...filters };
      localStorage.setItem(storageKey, JSON.stringify(next));
      return { filters: next };
    })
}));
