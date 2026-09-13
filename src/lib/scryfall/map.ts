import type { catalogCards, oracleCards, sets } from "@/db/schema";
import { normalizeForSearch } from "@/lib/search/normalize";
import type { ScryfallCard, ScryfallCardFace, ScryfallSet } from "./types";

export type CatalogCardRow = typeof catalogCards.$inferInsert;
export type SetRow = typeof sets.$inferInsert;
export type OracleCardRow = typeof oracleCards.$inferInsert;

/** The formats whose legality is kept; Scryfall's other twenty are niche or digital-only. */
export const FORMATS = ["commander", "standard", "pioneer", "modern", "legacy", "vintage", "pauper", "brawl"] as const;

/**
 * The rules side of a card, the same in all its printings (D35): cost, colours, types, text,
 * legality. Multi-faced cards without them at the top take them from their faces, joined with
 * " // ". Null without an oracle id.
 */
export function mapOracleCard(card: ScryfallCard): OracleCardRow | null {
  const faces = card.card_faces ?? [];
  const oracleId = card.oracle_id ?? faces[0]?.oracle_id;
  if (!oracleId) return null;
  const fromFaces = (pick: (f: ScryfallCardFace) => string | undefined) => {
    const parts = faces.map(pick).filter((v): v is string => !!v);
    return parts.length ? parts.join(" // ") : null;
  };
  return {
    oracleId,
    name: card.name,
    searchName: normalizeForSearch(card.name),
    frontSearchName: normalizeForSearch(faces[0]?.name ?? card.name),
    layout: card.layout ?? null,
    manaCost: card.mana_cost ?? fromFaces((f) => f.mana_cost),
    cmc: card.cmc ?? 0,
    colors: card.colors ?? [...new Set(faces.flatMap((f) => f.colors ?? []))],
    colorIdentity: card.color_identity ?? [],
    typeLine: card.type_line ?? fromFaces((f) => f.type_line),
    oracleText: card.oracle_text ?? (faces.length ? faces.map((f) => f.oracle_text ?? "").join("\n//\n") : null),
    keywords: card.keywords ?? [],
    producedMana: card.produced_mana ?? [],
    legalities: Object.fromEntries(FORMATS.map((f) => [f, card.legalities?.[f] ?? "not_legal"])),
    gameChanger: card.game_changer ?? false,
  };
}

export interface PrintedNameRow {
  setCode: string;
  collectorNumber: string;
  lang: string;
  printedName: string;
  searchName: string;
}

function price(value: string | null | undefined): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Maps a Scryfall card to a catalog row. Returns null for digital-only printings. */
export function mapScryfallCard(card: ScryfallCard, pricesUpdatedAt: Date): CatalogCardRow | null {
  if (card.digital) return null;

  const front = card.card_faces?.[0];
  const images = card.image_uris ?? front?.image_uris;

  return {
    game: "mtg",
    externalId: card.id,
    // Reversible cards carry the oracle id on each face instead of the card.
    oracleId: card.oracle_id ?? front?.oracle_id ?? null,
    name: card.name,
    searchName: normalizeForSearch(card.name),
    setCode: card.set,
    collectorNumber: card.collector_number,
    rarity: card.rarity,
    typeLine: card.type_line ?? front?.type_line ?? null,
    finishes: card.finishes,
    imageSmall: images?.small ?? null,
    imageNormal: images?.normal ?? null,
    releasedAt: card.released_at,
    cardmarketId: card.cardmarket_id ?? null,
    priceEur: price(card.prices.eur),
    priceEurFoil: price(card.prices.eur_foil),
    priceUsd: price(card.prices.usd),
    priceUsdFoil: price(card.prices.usd_foil),
    pricesUpdatedAt,
  };
}

/** Maps a physical Scryfall set to a row. Returns null for digital-only sets (Arena, MTGO). */
export function mapScryfallSet(set: ScryfallSet): SetRow | null {
  if (set.digital) return null;
  return {
    game: "mtg",
    code: set.code,
    name: set.name,
    setType: set.set_type,
    parentSetCode: set.parent_set_code ?? null,
    releasedAt: set.released_at ?? null,
    iconUri: set.icon_svg_uri,
    cardCount: set.card_count,
    printCode: set.code.toUpperCase(),
    printedTotal: set.printed_size ?? null,
  };
}

/**
 * Extracts the printed (translated) name of a non-English printing, to be attached to the
 * English printing with the same set and collector number.
 */
export function mapPrintedName(card: ScryfallCard): PrintedNameRow | null {
  if (card.digital || card.lang === "en") return null;

  const printedName =
    card.printed_name ??
    (card.card_faces?.every((f) => f.printed_name)
      ? card.card_faces.map((f) => f.printed_name).join(" // ")
      : undefined);
  if (!printedName) return null;

  return {
    setCode: card.set,
    collectorNumber: card.collector_number,
    lang: card.lang,
    printedName,
    searchName: normalizeForSearch(printedName),
  };
}
