import { pool } from "@/db/client";
import { numberVariants, type CollectorLine } from "@/lib/scan/parse";

export type ScanMatch = {
  id: string;
  game: string;
  name: string;
  setCode: string;
  setName: string;
  collectorNumber: string;
  imageSmall: string | null;
  finishes: string[];
  priceEur: number | null;
  printedTotal: number | null;
};

const SELECT = `
  select c.id, c.game, c.name, c.set_code as "setCode", s.name as "setName",
         c.collector_number as "collectorNumber", c.image_small as "imageSmall", c.finishes,
         c.price_eur::float8 as "priceEur", s.printed_total as "printedTotal"
  from catalog_cards c
  join sets s on s.game = c.game and s.code = c.set_code
  where c.collector_number = any($1::text[])`;

// Many sets share a size (a dozen Magic sets have 249 cards), so a number/total read can be
// ambiguous: return enough candidates, newest first, for the user to pick by image.
async function query(where: string, params: unknown[]) {
  const { rows } = await pool.query<ScanMatch>(
    `${SELECT} ${where} order by s.released_at desc nulls last limit 24`,
    params,
  );
  return rows;
}

/**
 * Finds the printings an OCR read can refer to. Only catalog hits count, which filters out
 * most OCR noise. Order of evidence:
 *   1. a set chosen by the user ("fixed set" mode: only the number needs reading),
 *   2. a set code read on the card (Magic, Pokémon SV+),
 *   3. the printed total ("001/195"), for cards without a code (older Pokémon and Magic).
 * More than one match means the caller must let the user pick.
 */
export async function lookupScan(
  line: CollectorLine,
  fixedSet?: { game: string; code: string } | null,
): Promise<ScanMatch[]> {
  const numbers = numberVariants(line.number);

  if (fixedSet) {
    return query("and s.game = $2 and lower(s.code) = lower($3)", [numbers, fixedSet.game, fixedSet.code]);
  }

  if (line.setCodes.length) {
    const rows = await query(
      "and (lower(s.code) = any($2::text[]) or upper(s.print_code) = any($3::text[]))",
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
    return query("and s.printed_total = $2", [numbers, Number(line.total)]);
  }
  return [];
}
