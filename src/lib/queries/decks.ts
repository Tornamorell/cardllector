import { pool } from "@/db/client";
import type { DeckCardInfo } from "@/lib/decks/analysis";

export type DeckRow = {
  id: string;
  name: string;
  format: string;
  description: string | null;
  /** Its box (D35). Null if someone deleted the location; «Traer al mazo» makes a new one. */
  locationId: string | null;
  locationName: string | null;
  updatedAt: string;
};

const DECK_COLUMNS = `
  d.id, d.name, d.format, d.description, d.location_id as "locationId", l.name as "locationName",
  d.updated_at::text as "updatedAt"`;

export async function listDecks(ownerId: string): Promise<DeckRow[]> {
  const { rows } = await pool.query<DeckRow>(
    `select ${DECK_COLUMNS} from decks d left join locations l on l.id = d.location_id
     where d.owner_id = $1 order by d.updated_at desc`,
    [ownerId],
  );
  return rows;
}

export async function getDeck(ownerId: string, id: string): Promise<DeckRow | null> {
  const { rows } = await pool.query<DeckRow>(
    `select ${DECK_COLUMNS} from decks d left join locations l on l.id = d.location_id
     where d.owner_id = $1 and d.id = $2`,
    [ownerId, id],
  );
  return rows[0] ?? null;
}

export type DeckCardRow = DeckCardInfo & {
  deckId: string;
  oracleId: string;
  /** The printing the owner chose, if any. */
  preferredPrintingId: string | null;
  /** The one shown: the chosen printing, else the newest with a picture. */
  printingId: string | null;
  imageSmall: string | null;
  setCode: string | null;
  collectorNumber: string | null;
  /** Copies of this card (any printing, ungraded) in the deck's box. */
  inBox: number;
  /** Copies elsewhere, not in any deck's box: they can be brought in. */
  free: number;
  freeWhere: string[];
  /** Copies in other decks' boxes. */
  inOtherDecks: number;
};

/**
 * A deck's cards (or all the owner's decks' cards) with their rules data, price and where
 * the owner's copies are (D35). Graded copies aren't counted: slabs don't go in decks.
 */
export async function deckCardRows(ownerId: string, deckId?: string): Promise<DeckCardRow[]> {
  const { rows } = await pool.query<DeckCardRow>(
    `select dc.deck_id as "deckId", dc.board, dc.quantity, dc.oracle_id as "oracleId",
            o.name, o.type_line as "typeLine", o.mana_cost as "manaCost", o.cmc::float8 as cmc,
            o.color_identity as "colorIdentity", o.produced_mana as "producedMana",
            o.oracle_text as "oracleText", o.keywords,
            o.legalities->>'commander' as "commanderLegality", o.game_changer as "gameChanger",
            dc.catalog_card_id as "preferredPrintingId",
            coalesce(pref.id, latest.id) as "printingId",
            coalesce(pref.image_small, latest.image_small) as "imageSmall",
            coalesce(pref.set_code, latest.set_code) as "setCode",
            coalesce(pref.collector_number, latest.collector_number) as "collectorNumber",
            coalesce(pref.price_eur, cheap.price_eur)::float8 as "priceEur",
            coalesce(own.in_box, 0)::int as "inBox",
            coalesce(own.free, 0)::int as free,
            coalesce(own.free_where, '{}') as "freeWhere",
            coalesce(own.in_other_decks, 0)::int as "inOtherDecks"
     from deck_cards dc
     join decks d on d.id = dc.deck_id
     join oracle_cards o on o.oracle_id = dc.oracle_id
     left join catalog_cards pref on pref.id = dc.catalog_card_id
     left join lateral (
       select c.price_eur from catalog_cards c
       where c.game = 'mtg' and c.oracle_id = dc.oracle_id and c.price_eur is not null
       order by c.price_eur limit 1
     ) cheap on true
     left join lateral (
       select c.id, c.image_small, c.set_code, c.collector_number from catalog_cards c
       where c.game = 'mtg' and c.oracle_id = dc.oracle_id and c.image_small is not null
       order by c.released_at desc nulls last limit 1
     ) latest on true
     left join lateral (
       select sum(i.quantity) filter (where i.location_id = d.location_id) as in_box,
              sum(i.quantity) filter (where i.location_id is distinct from d.location_id and od.id is null) as free,
              array_agg(distinct coalesce(l.name, 'Sin ubicación'))
                filter (where i.location_id is distinct from d.location_id and od.id is null) as free_where,
              sum(i.quantity) filter (where od.id is not null and od.id <> d.id) as in_other_decks
       from items i
       join catalog_cards c on c.id = i.catalog_card_id
       left join locations l on l.id = i.location_id
       left join decks od on od.location_id = i.location_id
       where i.owner_id = $1 and c.oracle_id = dc.oracle_id and i.grading_company is null
     ) own on true
     where d.owner_id = $1 ${deckId ? "and d.id = $2" : ""}
     order by o.name`,
    deckId ? [ownerId, deckId] : [ownerId],
  );
  return rows;
}

/** What's in a deck's box, by card: to spot copies there that the list doesn't have. */
export async function boxContents(ownerId: string, locationId: string) {
  const { rows } = await pool.query<{ oracleId: string; name: string; copies: number }>(
    `select c.oracle_id as "oracleId", min(c.name) as name, sum(i.quantity)::int as copies
     from items i join catalog_cards c on c.id = i.catalog_card_id
     where i.owner_id = $1 and i.location_id = $2 and c.oracle_id is not null
     group by c.oracle_id
     order by min(c.name)`,
    [ownerId, locationId],
  );
  return rows;
}
