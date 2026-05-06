export type PokemonCard = {
  id: string;
  name: string;
  number?: string;
  images?: {
    small?: string;
    large?: string;
  };
  set?: {
    id?: string;
    name?: string;
  };
  rarity?: string;
  tcgplayer?: {
    prices?: Record<
      string,
      {
        low?: number;
        market?: number;
        mid?: number;
        high?: number;
        directLow?: number;
      }
    >;
  };
  cardmarket?: {
    prices?: {
      averageSellPrice?: number;
      lowPrice?: number;
      trendPrice?: number;
      avg1?: number;
      avg7?: number;
      avg30?: number;
    };
  };
};

export type PokemonSet = {
  id: string;
  name: string;
  series?: string;
  ptcgoCode?: string;
  printedTotal?: number;
  total?: number;
};

export type ExploreCard = {
  id: string;
  name: string;
  image: string;
  set: string;
  setId?: string;
  number?: string;
  rarity?: string;
  marketPrice: number | null;
};

export type PaginatedCards = {
  cards: ExploreCard[];
  page: number;
  pageSize: number;
  totalCount: number;
};

export type CollectionItem = {
  id: number;
  userId: number;
  cardId: string;
  name: string;
  image: string;
  set: string;
  number?: string | null;
  rarity?: string | null;
  quantity: number;
  price: number;
  favorite: boolean;
  forTrade: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  avatarUrl?: string | null;
  interests?: string | null;
};
