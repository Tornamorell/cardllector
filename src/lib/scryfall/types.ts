// The subset of Scryfall's API objects we read. Full reference: https://scryfall.com/docs/api

export interface ScryfallImageUris {
  small: string;
  normal: string;
  large?: string;
  png?: string;
}

export interface ScryfallCardFace {
  name: string;
  printed_name?: string;
  oracle_id?: string;
  type_line?: string;
  mana_cost?: string;
  oracle_text?: string;
  colors?: string[];
  image_uris?: ScryfallImageUris;
}

export interface ScryfallPrices {
  eur: string | null;
  eur_foil: string | null;
  usd: string | null;
  usd_foil: string | null;
  usd_etched?: string | null;
  tix?: string | null;
}

export interface ScryfallCard {
  object: "card";
  id: string;
  oracle_id?: string;
  name: string;
  printed_name?: string;
  lang: string;
  set: string;
  collector_number: string;
  rarity: string;
  type_line?: string;
  // Rules data (the same in every printing), for deck analysis (D35).
  layout?: string;
  mana_cost?: string;
  cmc?: number;
  colors?: string[];
  color_identity?: string[];
  oracle_text?: string;
  keywords?: string[];
  produced_mana?: string[];
  legalities?: Record<string, string>;
  /** On Commander's Game Changers list, which sets a deck's bracket. */
  game_changer?: boolean;
  released_at: string;
  digital: boolean;
  finishes: string[];
  cardmarket_id?: number;
  image_uris?: ScryfallImageUris;
  card_faces?: ScryfallCardFace[];
  prices: ScryfallPrices;
}

export interface ScryfallSet {
  object: "set";
  code: string;
  name: string;
  set_type: string;
  released_at?: string;
  card_count: number;
  /** The total printed on cards ("001/280"); absent for sets that don't print it. */
  printed_size?: number;
  parent_set_code?: string;
  digital: boolean;
  icon_svg_uri: string;
}

export interface ScryfallBulkEntry {
  object: "bulk_data";
  type: "oracle_cards" | "unique_artwork" | "default_cards" | "all_cards" | "rulings" | string;
  updated_at: string;
  jsonl_download_uri: string;
  compressed_size: number;
}
