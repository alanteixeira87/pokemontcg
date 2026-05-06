import axios from "axios";
import type {
  AuthResponse,
  CollectionItem,
  DashboardStats,
  ExploreCard,
  ExploreSortOption,
  ImportResult,
  PaginatedCards,
  PokemonSet,
  SortOption,
  TradeCardsResponse,
  TradeMessage,
  TradeProposal,
  TradeSelectionInput,
  TradeStatus,
  TradeUser,
  WishlistAvailability,
  WishlistItem
} from "../types";

const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const apiBaseUrl = isLocalhost
  ? "http://localhost:3001/api"
  : "https://name-pokemon-tcg-local-api.onrender.com/api";

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

  async cards(params: { page: number; pageSize: number; search?: string; set?: string; sort?: ExploreSortOption }): Promise<PaginatedCards> {
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

  async addToCollection(card: ExploreCard, quantity = 1): Promise<CollectionItem> {
    const response = await api.post<CollectionItem>("/collection", {
      cardId: card.id,
      name: card.name,
      image: card.image,
      set: card.set,
      quantity,
      price: card.marketPrice ?? 0,
      number: card.number,
      rarity: card.rarity
    });
    return response.data;
  },

  async wishlist(): Promise<WishlistItem[]> {
    const response = await api.get<WishlistItem[]>("/wishlist");
    return response.data;
  },

  async addWishlist(card: ExploreCard): Promise<WishlistItem> {
    const response = await api.post<WishlistItem>("/wishlist", {
      cardId: card.id,
      name: card.name,
      image: card.image,
      set: card.set,
      number: card.number,
      rarity: card.rarity,
      variantType: "NORMAL",
      condition: "Nao informado",
      marketPrice: card.marketPrice ?? 0,
      priceSource: card.marketPrice ? "Mercado estimado" : "Estimativa local"
    });
    return response.data;
  },

  async removeWishlist(cardId: string): Promise<{ removed: boolean }> {
    const response = await api.delete<{ removed: boolean }>(`/wishlist/${encodeURIComponent(cardId)}`);
    return response.data;
  },

  async wishlistNotifications(): Promise<WishlistAvailability[]> {
    const response = await api.get<WishlistAvailability[]>("/wishlist/notifications");
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

  async clearCollection(): Promise<{ deleted: number }> {
    const response = await api.delete<{ deleted: number }>("/collection");
    return response.data;
  },

  async refreshCollectionPrices(): Promise<{ updated: number; skipped: number }> {
    const response = await api.post<{ updated: number; skipped: number }>("/collection/reprice");
    return response.data;
  },

  async trades(): Promise<CollectionItem[]> {
    const response = await api.get<CollectionItem[]>("/trades");
    return response.data;
  },

  async dashboard(): Promise<DashboardStats> {
    const response = await api.get<DashboardStats>("/dashboard");
    return response.data;
  },

  async tradeUsers(params: { search?: string; interest?: string } = {}): Promise<TradeUser[]> {
    const response = await api.get<TradeUser[]>("/trade/users", { params });
    return response.data;
  },

  async tradeUserCards(userId: number, params: { set?: string; search?: string } = {}): Promise<TradeCardsResponse> {
    const response = await api.get<TradeCardsResponse>(`/trade/users/${userId}/cards`, { params });
    return response.data;
  },

  async myTradeCards(params: { set?: string; search?: string } = {}): Promise<TradeCardsResponse> {
    const response = await api.get<TradeCardsResponse>("/trade/my-cards", { params });
    return response.data;
  },

  async tradeProposals(): Promise<TradeProposal[]> {
    const response = await api.get<TradeProposal[]>("/trade/proposals");
    return response.data;
  },

  async createTradeProposal(input: { receiverId: number; requestedCards: TradeSelectionInput[]; offeredCards: TradeSelectionInput[] }): Promise<TradeProposal> {
    const response = await api.post<TradeProposal>("/trade/proposals", input);
    return response.data;
  },

  async updateTradeStatus(id: number, status: "ACCEPTED" | "REJECTED" | "CANCELLED"): Promise<TradeProposal> {
    const response = await api.patch<TradeProposal>(`/trade/proposals/${id}/status`, { status });
    return response.data;
  },

  async updateCardVariants(collectionId: number, variants: Array<{ variantType: string; ownedQuantity: number; tradeQuantity: number }>): Promise<CollectionItem> {
    const response = await api.put<CollectionItem>(`/trade/collection/${collectionId}/variants`, { variants });
    return response.data;
  },

  async tradeMessages(id: number): Promise<TradeMessage[]> {
    const response = await api.get<TradeMessage[]>(`/trade/proposals/${id}/messages`);
    return response.data;
  },

  async sendTradeMessage(id: number, message: string): Promise<TradeMessage> {
    const response = await api.post<TradeMessage>(`/trade/proposals/${id}/messages`, { message });
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
