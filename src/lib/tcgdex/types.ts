// The subset of TCGdex API objects we read. Reference: https://tcgdex.dev

export interface TcgdexCardBrief {
  id: string;
  localId: string;
  name: string;
  image?: string;
}

export interface TcgdexSetBrief {
  id: string;
  name: string;
  logo?: string;
  symbol?: string;
  cardCount: { total: number; official: number };
}

export interface TcgdexSet extends TcgdexSetBrief {
  releaseDate?: string;
  serie: { id: string; name: string };
  abbreviation?: { official?: string };
  cards: TcgdexCardBrief[];
}

/** Cardmarket price guide, EUR. Plain fields = the card as printed; `-holo` = reverse holo. */
export interface TcgdexCardmarketPrice {
  updated?: string;
  unit?: string;
  idProduct?: number;
  avg?: number | null;
  low?: number | null;
  trend?: number | null;
  avg1?: number | null;
  avg7?: number | null;
  avg30?: number | null;
  "avg-holo"?: number | null;
  "low-holo"?: number | null;
  "trend-holo"?: number | null;
  "avg30-holo"?: number | null;
}

export interface TcgdexTcgplayerVariantPrice {
  productId?: number;
  lowPrice?: number | null;
  midPrice?: number | null;
  highPrice?: number | null;
  marketPrice?: number | null;
}

/** TCGplayer prices, USD, keyed by variant (normal, holofoil, reverseHolofoil…). */
export type TcgdexTcgplayerPrice = {
  unit?: string;
  updated?: string;
} & { [variant: string]: TcgdexTcgplayerVariantPrice | string | undefined };

export interface TcgdexVariants {
  normal?: boolean;
  reverse?: boolean;
  holo?: boolean;
  firstEdition?: boolean;
  wPromo?: boolean;
}

export interface TcgdexCard {
  id: string;
  localId: string;
  name: string;
  image?: string;
  category?: string;
  rarity?: string;
  hp?: number;
  types?: string[];
  stage?: string;
  trainerType?: string;
  energyType?: string;
  set: { id: string; name: string };
  variants?: TcgdexVariants;
  pricing?: {
    cardmarket?: TcgdexCardmarketPrice | null;
    tcgplayer?: TcgdexTcgplayerPrice | null;
  };
}
