// Server only: the cards a deck list names, in our catalog (D35).
import { pool } from "@/db/client";
import { normalizeForSearch } from "@/lib/search/normalize";
import type { Board, DecklistLine } from "./decklist";

export type ResolvedLine = { board: Board; quantity: number; oracleId: string; printingId: string | null };

/**
 * Each line's card, by its full name or a double-faced card's front face (tokens and art cards
 * aside), and the printing the line names if it exists. The same card twice on a board adds
 * up. `unknown` lists the names not found.
 */
export async function resolveDecklist(lines: DecklistLine[]): Promise<{ resolved: ResolvedLine[]; unknown: string[] }> {
  if (!lines.length) return { resolved: [], unknown: [] };
  const keys = [...new Set(lines.map((l) => normalizeForSearch(l.name)))];
  const { rows } = await pool.query<{ oracle_id: string; search_name: string; front_search_name: string }>(
    `select oracle_id, search_name, front_search_name from oracle_cards
     where (search_name = any($1) or front_search_name = any($1))
       and coalesce(layout, '') not in ('token', 'double_faced_token', 'art_series', 'emblem')`,
    [keys],
  );
  const byName = new Map<string, string>();
  for (const r of rows) byName.set(r.search_name, r.oracle_id);
  for (const r of rows) if (!byName.has(r.front_search_name)) byName.set(r.front_search_name, r.oracle_id);

  const named = lines.filter((l) => l.setCode && l.collectorNumber);
  const printings = new Map<string, string>();
  if (named.length) {
    const { rows: found } = await pool.query<{ id: string; oracle_id: string; set_code: string; collector_number: string }>(
      `select c.id, c.oracle_id, c.set_code, c.collector_number
       from catalog_cards c
       join unnest($1::text[], $2::text[]) as p(set_code, number)
         on c.set_code = p.set_code and c.collector_number = p.number
       where c.game = 'mtg'`,
      [named.map((l) => l.setCode), named.map((l) => l.collectorNumber)],
    );
    for (const p of found) printings.set(`${p.oracle_id}|${p.set_code}|${p.collector_number}`, p.id);
  }

  const merged = new Map<string, ResolvedLine>();
  const unknown: string[] = [];
  for (const line of lines) {
    const oracleId = byName.get(normalizeForSearch(line.name));
    if (!oracleId) {
      unknown.push(line.name);
      continue;
    }
    const key = `${line.board}|${oracleId}`;
    const printingId = printings.get(`${oracleId}|${line.setCode}|${line.collectorNumber}`) ?? null;
    const seen = merged.get(key);
    if (seen) {
      seen.quantity += line.quantity;
      seen.printingId ??= printingId;
    } else {
      merged.set(key, { board: line.board, quantity: line.quantity, oracleId, printingId });
    }
  }
  return { resolved: [...merged.values()], unknown };
}
