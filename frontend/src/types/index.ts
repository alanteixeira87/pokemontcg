export type ExploreCard = {
  id: string;
  name: string;
  image: string;
  set: string;
  setId?: string;
  number?: string;
  marketPrice: number | null;
};

export type MissingCard = ExploreCard & {
  isWanted: boolean;
};

export type MissingCardsResponse = {
  set: {
    id: string;
    name: string;
    printedTotal?: number;
    total?: number;
  };
  cards: MissingCard[];
};

export type WantedCard = {
  id: number;
  cardId: string;
  name: string;
  image: string;
  set: string;
  setId?: string | null;
  number?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ImportResult = {
  imported: number;
  skipped: number;
  totalRows?: number;
  validRows?: number;
  ignoredRows?: number;
  headerRow?: number;
  notFound: Array<{
    series: string;
    number: string;
    sequence: string;
    status: string;
    quantity: string;
    officialSetName?: string;
    officialSetId?: string;
    officialPrintedTotal?: number;
    officialTotal?: number;
    rowNumber?: number;
    reason?: string;
  }>;
  errors?: Array<{
    series: string;
    number: string;
    sequence: string;
    status: string;
    quantity: string;
    officialSetName?: string;
    officialSetId?: string;
    officialPrintedTotal?: number;
    officialTotal?: number;
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
  number?: string | null;
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

export type SortOption = "name" | "price" | "quantity" | "numberAsc" | "numberDesc";
export type ExploreSortOption = "numberAsc" | "numberDesc" | "name";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
};

export type AuthResponse = {
  token: string;
  user: AuthUser;
};

export type TradeUser = {
  id: number;
  name: string;
  avatarUrl?: string | null;
  interests?: string | null;
  tradeCardsCount: number;
  readyTradeCardsCount?: number;
  pendingVariantCardsCount?: number;
  mainCollections: string[];
  suggestedCards?: Array<{
    id: number;
    name: string;
    image: string;
    set: string;
    number: string | null;
    readyForTrade: boolean;
  }>;
};

export type VariantType = "NORMAL" | "FOIL" | "REVERSE_FOIL" | "RARE_ILLUSTRATION";

export type CardVariant = {
  id: number;
  userCardId: number;
  variantType: VariantType;
  ownedQuantity: number;
  tradeQuantity: number;
  label?: string;
};

export type TradeCard = CollectionItem & {
  variantSummary?: CardVariant[];
  variants?: CardVariant[];
  readyForTrade?: boolean;
};

export type TradeCardsResponse = {
  user?: {
    id: number;
    name: string;
    avatarUrl?: string | null;
  };
  sets: string[];
  cards: TradeCard[];
};

export type TradeStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELED" | "REJECTED" | "CANCELLED";

export type TradeCardSnapshot = {
  collectionId: number;
  cardId: string;
  name: string;
  image: string;
  set: string;
  number: string | null;
  variantType?: VariantType;
  quantity: number;
};

export type TradeCardLine = TradeCardSnapshot & {
  id: number;
  tradeId: number;
  side: "OFFERED" | "REQUESTED";
  variantType: VariantType;
};

export type TradeMessage = {
  id: number;
  tradeId: number;
  senderId: number;
  receiverId: number;
  message: string;
  isRead: boolean;
  createdAt: string;
};

export type TradeProposal = {
  id: number;
  requesterId: number;
  receiverId: number;
  requester: {
    id: number;
    name: string;
    avatarUrl?: string | null;
  };
  receiver: {
    id: number;
    name: string;
    avatarUrl?: string | null;
  };
  offeredCards: TradeCardSnapshot[];
  requestedCards: TradeCardSnapshot[];
  cards?: TradeCardLine[];
  messages?: TradeMessage[];
  status: TradeStatus;
  createdAt: string;
  updatedAt: string;
};

export type TradeSelectionInput = {
  collectionId: number;
  variantType: VariantType;
  quantity: number;
};
