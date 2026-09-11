import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export * from "./auth-schema";

export const game = pgEnum("game", ["mtg", "pokemon", "sports"]);
export const finish = pgEnum("finish", ["nonfoil", "foil", "etched"]);
// Cardmarket grading scale.
export const cardCondition = pgEnum("card_condition", ["MT", "NM", "EX", "GD", "LP", "PL", "PO"]);
export const itemSource = pgEnum("item_source", ["manual", "scan"]);

const money = (name: string) => numeric(name, { precision: 10, scale: 2, mode: "number" });

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
};

// ---------------------------------------------------------------------------
// Catalog — synced from external sources (Scryfall for Magic, TCGdex for Pokémon).
// Never edited by hand. See docs/data-sources.md.
// ---------------------------------------------------------------------------

export const sets = pgTable(
  "sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    game: game("game").notNull(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    setType: text("set_type"),
    parentSetCode: text("parent_set_code"),
    releasedAt: date("released_at"),
    iconUri: text("icon_uri"),
    cardCount: integer("card_count"),
    // What's printed on the cards, used by the scanner: the set code ("MKM", "PAL") and the
    // total after the slash in "001/193". Null when the cards don't print it.
    printCode: text("print_code"),
    printedTotal: integer("printed_total"),
  },
  (t) => [uniqueIndex("sets_game_code_uq").on(t.game, t.code)],
);

export const catalogCards = pgTable(
  "catalog_cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    game: game("game").notNull(),
    // Id in the source catalog (Scryfall card id, TCGdex card id).
    externalId: text("external_id").notNull(),
    // Groups every printing of the same card: Scryfall oracle_id, "pokemon:<name>" (D19).
    oracleId: text("oracle_id"),
    name: text("name").notNull(),
    // Lowercased, accent-free name used for trigram search. See normalizeForSearch().
    searchName: text("search_name").notNull(),
    setCode: text("set_code").notNull(),
    collectorNumber: text("collector_number").notNull(),
    rarity: text("rarity"),
    typeLine: text("type_line"),
    finishes: text("finishes").array().notNull().default(sql`'{}'::text[]`),
    imageSmall: text("image_small"),
    imageNormal: text("image_normal"),
    releasedAt: date("released_at"),
    cardmarketId: integer("cardmarket_id"),
    priceEur: money("price_eur"),
    priceEurFoil: money("price_eur_foil"),
    priceUsd: money("price_usd"),
    priceUsdFoil: money("price_usd_foil"),
    pricesUpdatedAt: timestamp("prices_updated_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("catalog_cards_game_external_uq").on(t.game, t.externalId),
    index("catalog_cards_set_number_idx").on(t.game, t.setCode, t.collectorNumber),
    index("catalog_cards_oracle_idx").on(t.oracleId),
    index("catalog_cards_search_trgm_idx").using("gin", sql`${t.searchName} gin_trgm_ops`),
  ],
);

// Printed names in other languages (Spanish for now), pointing at the English printing
// that carries the price. Lets the user search "Rayo" and find Lightning Bolt.
export const cardNames = pgTable(
  "card_names",
  {
    catalogCardId: uuid("catalog_card_id")
      .notNull()
      .references(() => catalogCards.id, { onDelete: "cascade" }),
    lang: text("lang").notNull(),
    printedName: text("printed_name").notNull(),
    searchName: text("search_name").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.catalogCardId, t.lang] }),
    index("card_names_search_trgm_idx").using("gin", sql`${t.searchName} gin_trgm_ops`),
  ],
);

// ---------------------------------------------------------------------------
// The user's collections.
// ---------------------------------------------------------------------------

export const collections = pgTable(
  "collections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    ...timestamps,
  },
  (t) => [index("collections_owner_idx").on(t.ownerId)],
);

// Where copies physically are ("Caja 1", "Carpeta roja"). Independent of collections: a
// collection can span several locations and a location can hold several collections (D20).
export const locations = pgTable(
  "locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    ...timestamps,
  },
  (t) => [uniqueIndex("locations_owner_name_uq").on(t.ownerId, sql`lower(${t.name})`)],
);

// The inventory: stacks of identical physical copies the user owns. Adding a copy identical to
// an existing stack bumps its quantity instead of creating a new row. Copies don't belong to
// collections (those are lists, see collection_cards); they may have a location (D23).
export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Null for items without a catalog entry (e.g. sports cards entered by hand).
    catalogCardId: uuid("catalog_card_id").references(() => catalogCards.id, {
      onDelete: "restrict",
    }),
    quantity: integer("quantity").notNull().default(1),
    finish: finish("finish").notNull().default("nonfoil"),
    condition: cardCondition("condition").notNull().default("NM"),
    language: text("language").notNull().default("en"),
    gradingCompany: text("grading_company"),
    grade: numeric("grade", { precision: 3, scale: 1, mode: "number" }),
    purchasePriceEur: money("purchase_price_eur"),
    purchasedAt: date("purchased_at"),
    locationId: uuid("location_id").references(() => locations.id, { onDelete: "set null" }),
    notes: text("notes"),
    // Free-form details for games without a catalog (player, team, parallel, /numbered…).
    attributes: jsonb("attributes").$type<Record<string, string>>(),
    source: itemSource("source").notNull().default("manual"),
    ...timestamps,
  },
  (t) => [
    index("items_catalog_card_idx").on(t.catalogCardId),
    index("items_location_idx").on(t.locationId),
    index("items_owner_idx").on(t.ownerId),
    check("items_quantity_positive", sql`${t.quantity} > 0`),
  ],
);

// The cards a collection is made of: a curated list ("Pokédex de Hoenn", a wishlist), owned
// or not. Ownership is computed against `items` (D23).
export const collectionCards = pgTable(
  "collection_cards",
  {
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    catalogCardId: uuid("catalog_card_id")
      .notNull()
      .references(() => catalogCards.id, { onDelete: "cascade" }),
    // Copies wanted (4 for a Magic playset, usually 1).
    quantity: integer("quantity").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.collectionId, t.catalogCardId] }),
    index("collection_cards_card_idx").on(t.catalogCardId),
    check("collection_cards_quantity_positive", sql`${t.quantity} > 0`),
  ],
);

// ---------------------------------------------------------------------------
// Price history. Only printings the user owns get daily snapshots.
// ---------------------------------------------------------------------------

export const priceSnapshots = pgTable(
  "price_snapshots",
  {
    catalogCardId: uuid("catalog_card_id")
      .notNull()
      .references(() => catalogCards.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    eur: money("eur"),
    eurFoil: money("eur_foil"),
    usd: money("usd"),
    usdFoil: money("usd_foil"),
  },
  (t) => [primaryKey({ columns: [t.catalogCardId, t.date] })],
);

// The whole inventory's value per day: what the dashboard's history chart will read.
export const inventoryValueSnapshots = pgTable(
  "inventory_value_snapshots",
  {
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    valueEur: numeric("value_eur", { precision: 12, scale: 2, mode: "number" }).notNull(),
    cardCount: integer("card_count").notNull(),
    unpricedCount: integer("unpriced_count").notNull(),
  },
  (t) => [primaryKey({ columns: [t.ownerId, t.date] })],
);
