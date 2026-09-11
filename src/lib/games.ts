/**
 * Per-game catalog configuration: how a game is named in URLs and UI, its rarity scale, how
 * its sets are grouped for browsing and what its finishes are called. Adding a game means
 * adding an entry here plus a sync script that fills `sets` and `catalog_cards` with that
 * `game`. Pure data — safe to import from client components.
 */

export type CatalogGameId = "mtg" | "pokemon";
export type Finish = "nonfoil" | "foil" | "etched";

export interface SetGroup {
  key: string;
  label: string;
  /** Set types in this group; "rest" catches every type not listed in another group. */
  types: string[] | "rest";
}

export interface GameConfig {
  id: CatalogGameId;
  slug: string;
  name: string;
  shortName: string;
  /** False while no catalog source is wired up for the game. */
  available: boolean;
  /** Where catalog and prices come from, for attribution in the UI. */
  sourceName: string;
  /** Cardmarket URL segment: cardmarket.com/es/{category}/Products?idProduct=… */
  cardmarketCategory: string;
  /**
   * Known rarities, lowest first, keyed by the stored (lowercased) value. Labels stay in
   * English — it's how collectors name them (D21).
   */
  rarities: Array<{ value: string; label: string }>;
  /** Browsing tabs; the first one is the default. */
  setGroups: SetGroup[];
  setTypeLabels: Record<string, string>;
  /** Our finishes are generic; each game names them its own way (D18). */
  finishLabels: Record<Finish, string>;
}

export const GAMES: GameConfig[] = [
  {
    id: "mtg",
    slug: "magic",
    name: "Magic: The Gathering",
    shortName: "Magic",
    available: true,
    sourceName: "Scryfall",
    cardmarketCategory: "Magic",
    rarities: [
      { value: "common", label: "Common" },
      { value: "uncommon", label: "Uncommon" },
      { value: "rare", label: "Rare" },
      { value: "mythic", label: "Mythic" },
      { value: "special", label: "Special" },
      { value: "bonus", label: "Bonus" },
    ],
    // Types from Scryfall's `set_type`.
    setGroups: [
      { key: "main", label: "Principales", types: ["core", "expansion"] },
      { key: "commander", label: "Commander", types: ["commander"] },
      { key: "special", label: "Especiales", types: "rest" },
      { key: "promo", label: "Promos y tokens", types: ["promo", "token", "memorabilia"] },
    ],
    setTypeLabels: {
      core: "Básica",
      expansion: "Expansión",
      commander: "Commander",
      masters: "Masters",
      draft_innovation: "Draft",
      eternal: "Eterna",
      masterpiece: "Masterpiece",
      from_the_vault: "From the Vault",
      spellbook: "Spellbook",
      premium_deck: "Premium Deck",
      duel_deck: "Duel Deck",
      starter: "Iniciación",
      box: "Caja",
      planechase: "Planechase",
      archenemy: "Archenemy",
      funny: "Humor",
      promo: "Promo",
      token: "Tokens",
      memorabilia: "Memorabilia",
    },
    finishLabels: { nonfoil: "Normal", foil: "Foil", etched: "Etched" },
  },
  {
    id: "pokemon",
    slug: "pokemon",
    name: "Pokémon TCG",
    shortName: "Pokémon",
    available: true,
    sourceName: "TCGdex",
    cardmarketCategory: "Pokemon",
    // TCGdex rarities, lowercased (see normalizeRarity); labels restore the official casing.
    rarities: [
      { value: "common", label: "Common" },
      { value: "uncommon", label: "Uncommon" },
      { value: "rare", label: "Rare" },
      { value: "rare holo", label: "Rare Holo" },
      { value: "rare holo lv.x", label: "Rare Holo LV.X" },
      { value: "rare prime", label: "Rare PRIME" },
      { value: "legend", label: "LEGEND" },
      { value: "holo rare v", label: "Holo Rare V" },
      { value: "holo rare vmax", label: "Holo Rare VMAX" },
      { value: "holo rare vstar", label: "Holo Rare VSTAR" },
      { value: "double rare", label: "Double Rare" },
      { value: "ace spec rare", label: "ACE SPEC Rare" },
      { value: "radiant rare", label: "Radiant Rare" },
      { value: "amazing rare", label: "Amazing Rare" },
      { value: "illustration rare", label: "Illustration Rare" },
      { value: "ultra rare", label: "Ultra Rare" },
      { value: "full art trainer", label: "Full Art Trainer" },
      { value: "special illustration rare", label: "Special Illustration Rare" },
      { value: "shiny rare", label: "Shiny Rare" },
      { value: "shiny rare v", label: "Shiny Rare V" },
      { value: "shiny rare vmax", label: "Shiny Rare VMAX" },
      { value: "shiny ultra rare", label: "Shiny Ultra Rare" },
      { value: "hyper rare", label: "Hyper Rare" },
      { value: "mega hyper rare", label: "Mega Hyper Rare" },
      { value: "secret rare", label: "Secret Rare" },
      { value: "black white rare", label: "Black White Rare" },
      { value: "classic collection", label: "Classic Collection" },
      { value: "promo", label: "Promo" },
      { value: "none", label: "None" },
    ],
    // set_type holds the TCGdex series id. Newest series first.
    setGroups: [
      { key: "me", label: "Megaevolución", types: ["me"] },
      { key: "sv", label: "Escarlata y Púrpura", types: ["sv"] },
      { key: "swsh", label: "Espada y Escudo", types: ["swsh"] },
      { key: "sm", label: "Sol y Luna", types: ["sm"] },
      { key: "xy", label: "XY", types: ["xy"] },
      { key: "bw", label: "Negro y Blanco", types: ["bw"] },
      { key: "older", label: "Anteriores", types: "rest" },
    ],
    setTypeLabels: {
      misc: "Varios",
      base: "Clásica",
      gym: "Gym",
      neo: "Neo",
      lc: "Legendary Collection",
      ecard: "e-Card",
      ex: "EX",
      pop: "POP",
      tk: "Kits de entrenador",
      dp: "Diamante y Perla",
      pl: "Platino",
      hgss: "HeartGold SoulSilver",
      col: "Call of Legends",
      bw: "Negro y Blanco",
      mc: "McDonald's",
      xy: "XY",
      sm: "Sol y Luna",
      swsh: "Espada y Escudo",
      sv: "Escarlata y Púrpura",
      me: "Megaevolución",
    },
    finishLabels: { nonfoil: "Estándar", foil: "Reverse holo", etched: "Etched" },
  },
];

export function gameBySlug(slug: string): GameConfig | null {
  return GAMES.find((g) => g.slug === slug) ?? null;
}

export function gameById(id: string | null | undefined): GameConfig | null {
  return GAMES.find((g) => g.id === id) ?? null;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function rarityLabel(game: GameConfig, rarity: string | null): string {
  if (!rarity) return "—";
  return game.rarities.find((r) => r.value === rarity)?.label ?? capitalize(rarity);
}

/** Sort key for rarities: known ones in scale order, unknown ones after. */
export function rarityRank(game: GameConfig, rarity: string | null): number {
  const i = game.rarities.findIndex((r) => r.value === rarity);
  return i === -1 ? game.rarities.length : i;
}

export type RarityTier = "common" | "uncommon" | "rare" | "mythic" | "special";

/**
 * Colour tier of a rarity, like the set symbol colours on Magic cards: common (grey), uncommon
 * (silver), rare (gold), mythic (orange-red), special (violet). Pokémon's long ladder is folded
 * onto the same tiers. Rendered by <RarityMark>, colours in globals.css (--rarity-*).
 */
export function rarityTier(rarity: string | null): RarityTier {
  const r = rarity ?? "";
  if (r === "uncommon") return "uncommon";
  if (r === "mythic" || /secret|hyper|special illustration|gold|crown/.test(r)) return "mythic";
  if (r === "special" || r === "bonus") return "special";
  if (/illustration|ultra|double|ace spec|radiant|amazing|shiny|full art|legend|prime|lv\.x|\bv(max|star)?\b|black white/.test(r))
    return "special";
  if (/rare/.test(r)) return "rare";
  return "common";
}

export function setTypeLabel(game: GameConfig, setType: string | null): string {
  if (!setType) return "";
  return game.setTypeLabels[setType] ?? setType.replaceAll("_", " ");
}

export function finishLabel(gameId: string | null | undefined, finish: Finish): string {
  return (gameById(gameId) ?? GAMES[0]).finishLabels[finish];
}

export function defaultSetGroup(game: GameConfig): string {
  return game.setGroups[0]?.key ?? "all";
}

export type SetTypeFilter = { include: string[] } | { exclude: string[] };

/** Set types to include (or exclude, for the catch-all group) when browsing a group. */
export function setTypeFilter(game: GameConfig, groupKey: string): SetTypeFilter | null {
  const group = game.setGroups.find((g) => g.key === groupKey);
  if (!group) return null;
  if (group.types !== "rest") return { include: group.types };
  return { exclude: game.setGroups.flatMap((g) => (g.types === "rest" ? [] : g.types)) };
}
