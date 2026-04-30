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
  tcgplayer?: {
    prices?: Record<
      string,
      {
        market?: number;
        mid?: number;
      }
    >;
  };
};

export type PokemonSet = {
  id: string;
  name: string;
  series?: string;
};

export type ExploreCard = {
  id: string;
  name: string;
  image: string;
  set: string;
  setId?: string;
  number?: string;
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
  cardId: string;
  name: string;
  image: string;
  set: string;
  quantity: number;
  price: number;
  favorite: boolean;
  forTrade: boolean;
  createdAt: Date;
  updatedAt: Date;
};
