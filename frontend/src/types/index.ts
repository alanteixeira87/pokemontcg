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
  number?: string | null;
  rarity?: string | null;
  quantity: number;
  price: number;
  favorite: boolean;
  forTrade: boolean;
  createdAt: string;
  updatedAt: string;
};

export type WishlistAvailability = {
  cardId: string;
  name: string;
  image: string;
  set: string;
  number?: string | null;
  condition: string;
  variantType: string;
  requestedPrice: number;
  quantity: number;
  owner: {
    id: number;
    name: string;
    avatarUrl?: string | null;
  };
};

export type WishlistItem = {
  id: number;
  userId: number;
  cardId: string;
  name: string;
  image: string;
  set: string;
  number?: string | null;
  rarity?: string | null;
  variantType?: string | null;
  condition: string;
  marketPrice: number;
  priceSource: string;
  createdAt: string;
  updatedAt: string;
  availability?: WishlistAvailability | null;
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
  avatarUrl?: string | null;
  interests?: string | null;
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

export type UserProfile = AuthUser & {
  createdAt: string;
  _count: {
    collection: number;
    sentTrades: number;
    receivedTrades: number;
    wishlist: number;
  };
};

export type AdminOverview = {
  users: number;
  collectionCards: number;
  wishlistItems: number;
  trades: number;
  cachedCards: number;
  cachedSets: number;
  priceRows: number;
  latestPrices: Array<{
    id: number;
    cardName: string;
    collectionName: string;
    estimatedPrice: number;
    source: string;
    confidence: string;
    status: string;
    createdAt: string;
  }>;
  recentErrors: string[];
};

export type AdminUser = {
  id: number;
  name: string;
  email: string;
  avatarUrl?: string | null;
  interests?: string | null;
  createdAt: string;
  updatedAt: string;
  _count: {
    collection: number;
    wishlist: number;
    sentTrades: number;
    receivedTrades: number;
  };
};
