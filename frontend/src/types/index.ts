export type ExploreCard = {
  id: string;
  name: string;
  image: string;
  set: string;
  setId?: string;
  number?: string;
  marketPrice: number | null;
};

export type ImportResult = {
  imported: number;
  skipped: number;
  notFound: Array<{
    series: string;
    number: string;
    sequence: string;
    status: string;
    quantity: string;
    rowNumber?: number;
    reason?: string;
  }>;
};

export type PokemonSet = {
  id: string;
  name: string;
  series?: string;
  ptcgoCode?: string;
  printedTotal?: number;
  total?: number;
};

export type PaginatedCards = {
  cards: ExploreCard[];
  page: number;
  pageSize: number;
  totalCount: number;
};

export type CollectionItem = {
  id: number;
  cardId: string;
  name: string;
  image: string;
  set: string;
  quantity: number;
  price: number;
  favorite: boolean;
  forTrade: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DashboardStats = {
  totalCards: number;
  uniqueCards: number;
  totalValue: number;
  favorites: number;
  forTrade: number;
};

export type SortOption = "name" | "price" | "quantity";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
};

export type AuthResponse = {
  token: string;
  user: AuthUser;
};
