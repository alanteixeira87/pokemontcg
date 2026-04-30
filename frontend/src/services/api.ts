import axios from "axios";
import type { AuthResponse, CollectionItem, DashboardStats, ExploreCard, ImportResult, PaginatedCards, PokemonSet, SortOption } from "../types";

const apiBaseUrl = (import.meta.env.VITE_API_URL ?? "http://localhost:3001/api").replace(/\/$/, "");

export const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 12000
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("pokemon-tcg-token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("pokemon-tcg-token");
      localStorage.removeItem("pokemon-tcg-user");
    }
    return Promise.reject(error);
  }
);

export type CollectionFilters = {
  set?: string;
  favorite?: boolean;
  forTrade?: boolean;
  sort?: SortOption;
};

function booleanParam(value?: boolean): string | undefined {
  return typeof value === "boolean" ? String(value) : undefined;
}

export const apiService = {
  async register(input: { name: string; email: string; password: string }): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>("/auth/register", input);
    return response.data;
  },

  async login(input: { email: string; password: string }): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>("/auth/login", input);
    return response.data;
  },

  async me(): Promise<{ user: AuthResponse["user"] }> {
    const response = await api.get<{ user: AuthResponse["user"] }>("/auth/me");
    return response.data;
  },

  async cards(params: { page: number; pageSize: number; search?: string; set?: string }): Promise<PaginatedCards> {
    const response = await api.get<PaginatedCards>("/cards", { params });
    return response.data;
  },

  async sets(): Promise<PokemonSet[]> {
    const response = await api.get<PokemonSet[]>("/sets");
    return response.data;
  },

  async collection(filters: CollectionFilters = {}): Promise<CollectionItem[]> {
    const response = await api.get<CollectionItem[]>("/collection", {
      params: {
        set: filters.set || undefined,
        favorite: booleanParam(filters.favorite),
        forTrade: booleanParam(filters.forTrade),
        sort: filters.sort ?? "name"
      }
    });
    return response.data;
  },

  async addToCollection(card: ExploreCard): Promise<CollectionItem> {
    const response = await api.post<CollectionItem>("/collection", {
      cardId: card.id,
      name: card.name,
      image: card.image,
      set: card.set,
      quantity: 1,
      price: card.marketPrice ?? 0,
      number: card.number
    });
    return response.data;
  },

  async importCollection(file: File): Promise<ImportResult> {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post<ImportResult>("/import/collection", formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });
    return response.data;
  },

  async updateCollection(id: number, data: Partial<Pick<CollectionItem, "quantity" | "price" | "favorite" | "forTrade">>): Promise<CollectionItem> {
    const response = await api.patch<CollectionItem>(`/collection/${id}`, data);
    return response.data;
  },

  async removeCollection(id: number): Promise<void> {
    await api.delete(`/collection/${id}`);
  },

  async trades(): Promise<CollectionItem[]> {
    const response = await api.get<CollectionItem[]>("/trades");
    return response.data;
  },

  async dashboard(): Promise<DashboardStats> {
    const response = await api.get<DashboardStats>("/dashboard");
    return response.data;
  },

  exportUrl(type: "full" | "set" | "card", value?: string): string {
    const params = new URLSearchParams({ type });
    if (type === "set" && value) params.set("set", value);
    if (type === "card" && value) params.set("id", value);
    const token = localStorage.getItem("pokemon-tcg-token");
    if (token) params.set("token", token);
    return `${apiBaseUrl}/export?${params.toString()}`;
  }
};
