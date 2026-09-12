import { pool } from "@/db/client";
import { numberVariants, type CollectorLine } from "@/lib/scan/parse";
import { normalizeForSearch } from "@/lib/search/normalize";

export type ScanMatch = {
  id: string;
  game: string;
  name: string;
  setCode: string;
  setName: string;
  collectorNumber: string;
  imageSmall: string | null;
  rarity: string | null;
  finishes: string[];
  priceEur: number | null;
  priceEurFoil: number | null;
  printedTotal: number | null;
};

const COLUMNS = `
  c.id, c.game, c.name, c.set_code as "setCode", s.name as "setName",
  c.collector_number as "collectorNumber", c.image_small as "imageSmall", c.rarity, c.finishes,
  c.price_eur::float8 as "priceEur", c.price_eur_foil::float8 as "priceEurFoil",
  s.printed_total as "printedTotal"`;

// Many sets share a size (a dozen Magic sets have 249 cards) and popular cards have dozens of
// printings, so reads can be ambiguous: return enough candidates, newest first, to pick from.
async function find(where: string, params: unknown[]) {
  const { rows } = await pool.query<ScanMatch>(
    `select ${COLUMNS}
     from catalog_cards c
     join sets s on s.game = c.game and s.code = c.set_code
     where ${where}
     order by s.released_at desc nulls last, c.collector_number
     limit 24`,
    params,
  );
  return rows;
}

/**
 * Finds the printings a collector-line read can refer to. Only catalog hits count, which
 * filters out most OCR noise. Order of evidence:
 *   1. a set chosen by the user ("fixed set" mode: only the number needs reading),
 *   2. a set code read on the card (Magic, Pokémon SV+),
 *   3. the printed total ("001/195"), for cards without a code.
 * More than one match means the caller must let the user pick.
 */
export async function lookupScan(
  line: CollectorLine,
  fixedSet?: { game: string; code: string } | null,
): Promise<ScanMatch[]> {
  const numbers = numberVariants(line.number);
  const byNumber = "c.collector_number = any($1::text[])";

  if (fixedSet) {
    return find(`${byNumber} and s.game = $2 and lower(s.code) = lower($3)`, [
      numbers,
      fixedSet.game,
      fixedSet.code,
    ]);
  }

  if (line.setCodes.length) {
    const rows = await find(
      `${byNumber} and (lower(s.code) = any($2::text[]) or upper(s.print_code) = any($3::text[]))`,
      [numbers, line.setCodes.map((c) => c.toLowerCase()), line.setCodes],
    );
    if (rows.length > 1 && line.total) {
      const total = Number(line.total);
      const exact = rows.filter((r) => r.printedTotal === total);
      if (exact.length) return exact;
    }
    if (rows.length) return rows;
  }

  if (line.total) {
    return find(`${byNumber} and s.printed_total = $2`, [numbers, Number(line.total)]);
  }
  return [];
}

/**
 * When an OCR'd title counts as a card name: a clearly similar name, or a reasonably similar
 * one that clearly beats the runner-up. ("aerial ee" is 0.45 to "Erial" — Wasteland in
 * Spanish — and 0.44 to four "Aerial …" cards: too close to call.)
 */
const NAME_SIMILARITY_SURE = 0.6;
const NAME_SIMILARITY_MIN = 0.45;
const NAME_MARGIN = 0.1;
/** In an album, how far below the best match a card's name may be and still be offered. */
const ALBUM_NAME_WINDOW = 0.35;

/**
 * Football albums print the name, not a number, on the front, and a player has several cards
 * in the same album (base, Élite and its Power parallel, Special One…), sometimes with the
 * name spelt differently ("Lamin Yamal"). So: every card of the album whose name is close to
 * the best match, or contains what was read, for the user to pick (D29).
 */
async function lookupInAlbum(q: string, album: { game: string; code: string }) {
  const { rows } = await pool.query<{ best: number | null }>(
    `select max(similarity(c.search_name, $1))::float8 as best
     from catalog_cards c
     where c.game = $2 and lower(c.set_code) = lower($3)`,
    [q, album.game, album.code],
  );
  const best = rows[0]?.best ?? 0;
  if (best < NAME_SIMILARITY_MIN) return [];
  return find(
    `c.game = $2 and lower(c.set_code) = lower($3)
     and (similarity(c.search_name, $1) >= $4 or c.search_name like '%' || $1 || '%')`,
    [q, album.game, album.code, Math.max(NAME_SIMILARITY_MIN, best - ALBUM_NAME_WINDOW)],
  );
}

/**
 * Fallback when the collector line can't be read: the card whose English or Spanish name best
 * matches the OCR'd title, and its printings (only the fixed set's, if one is chosen).
 */
export async function lookupByName(
  name: string,
  fixedSet?: { game: string; code: string } | null,
): Promise<ScanMatch[]> {
  const q = normalizeForSearch(name);
  if (q.replace(/[^a-z]/g, "").length < 4) return [];
  if (fixedSet?.game === "sports") return lookupInAlbum(q, fixedSet);

  // OCR tends to put a junk word before the title ("and Hoppip", "fi Lightning Bolt", from the
  // Pokémon stage badge or the frame): also try without it, and keep the best match. (Dropping
  // the last word was tried and discarded: "Aerial EE" → "aerial" matched "Aerial Guide".)
  const words = q.split(" ");
  const variants = [...new Set([q, words.slice(1).join(" ")])].filter(
    (v) => v.replace(/[^a-z]/g, "").length >= 4,
  );

  // Best similarity per card across all variants.
  const byOracle = new Map<string, { oracle_id: string; sim: number; len: number }>();
  for (const variant of variants) {
    const { rows } = await pool.query<{ oracle_id: string; sim: number; len: number }>(
      `select oracle_id, max(sim)::float8 as sim, min(len) as len
       from (
         select c.oracle_id, similarity(c.search_name, $1) as sim, length(c.search_name) as len
         from catalog_cards c
         where c.search_name % $1
         union all
         select c.oracle_id, similarity(n.search_name, $1), length(n.search_name)
         from card_names n
         join catalog_cards c on c.id = n.catalog_card_id
         where n.search_name % $1
       ) m
       where oracle_id is not null
       group by oracle_id
       order by sim desc, len asc
       limit 3`,
      [variant],
    );
    for (const row of rows) {
      const seen = byOracle.get(row.oracle_id);
      if (!seen || row.sim > seen.sim) byOracle.set(row.oracle_id, row);
    }
  }

  // Ties go to the shortest name: "Lightning Bolt // Lightning Bolt" (an art card) has the
  // same trigrams as "Lightning Bolt".
  const [best, second] = [...byOracle.values()].sort((a, b) => b.sim - a.sim || a.len - b.len);
  if (!best) return [];
  const sure = best.sim >= NAME_SIMILARITY_SURE;
  const clear = best.sim >= NAME_SIMILARITY_MIN && (!second || best.sim - second.sim >= NAME_MARGIN);
  if (!sure && !clear) return [];

  if (fixedSet) {
    return find("c.oracle_id = $1 and s.game = $2 and lower(s.code) = lower($3)", [
      best.oracle_id,
      fixedSet.game,
      fixedSet.code,
    ]);
  }
  return find("c.oracle_id = $1", [best.oracle_id]);
}
