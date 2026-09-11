import { pool } from "@/db/client";
import { normalizeForSearch } from "@/lib/search/normalize";

export interface CardSearchResult {
  /** Groups printings of the same card: Scryfall oracle_id, or "pokemon:<name>" (D19). */
  oracleId: string;
  game: string;
  name: string;
  /** Spanish name, when the match came from it (or the card has one). */
  printedName: string | null;
  /** Most recent paper printing — used for the thumbnail and as the default link target. */
  printingId: string;
  imageSmall: string | null;
  printings: number;
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Card-level (oracle) search over English and Spanish names of every game, accent-insensitive.
 * Prefix matches rank first, then trigram similarity.
 */
export async function searchCards(query: string, limit = 12): Promise<CardSearchResult[]> {
  const q = normalizeForSearch(query);
  if (q.length < 2) return [];

  const { rows } = await pool.query<CardSearchResult>(
    `with matches as (
       select c.oracle_id, c.search_name as s, null::text as printed_name
       from catalog_cards c
       where c.oracle_id is not null and c.search_name like $1
       union all
       select c.oracle_id, n.search_name, n.printed_name
       from card_names n
       join catalog_cards c on c.id = n.catalog_card_id
       where n.search_name like $1 and c.oracle_id is not null
     ),
     ranked as (
       select oracle_id,
              max(printed_name) as printed_name,
              bool_or(s like $2) as prefix,
              max(similarity(s, $3)) as sim
       from matches
       group by oracle_id
       order by prefix desc, sim desc
       limit $4
     )
     select r.oracle_id as "oracleId", latest.game, latest.name, r.printed_name as "printedName",
            latest.id as "printingId", latest.image_small as "imageSmall",
            latest.printings::int as printings
     from ranked r
     cross join lateral (
       select c.id, c.game, c.name, c.image_small, count(*) over () as printings
       from catalog_cards c
       where c.oracle_id = r.oracle_id
       order by c.released_at desc nulls last
       limit 1
     ) latest
     order by r.prefix desc, r.sim desc, latest.name`,
    [`%${escapeLike(q)}%`, `${escapeLike(q)}%`, q, limit],
  );
  return rows;
}
