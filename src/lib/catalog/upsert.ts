import { getTableColumns, sql, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { db, pool } from "@/db/client";
import { catalogCards, sets } from "@/db/schema";
import type { CatalogCardRow, PrintedNameRow, SetRow } from "@/lib/scryfall/map";

/** `SET col = excluded.col` for every given column, for ON CONFLICT DO UPDATE. */
function excluded<T extends PgTable>(table: T, keys: Array<keyof T["$inferInsert"]>) {
  const columns = getTableColumns(table) as Record<string, { name: string }>;
  return Object.fromEntries(
    keys.map((key) => [key, sql.raw(`excluded."${columns[key as string].name}"`)]),
  ) as Record<string, SQL>;
}

export async function upsertSets(rows: SetRow[]) {
  if (!rows.length) return;
  await db
    .insert(sets)
    .values(rows)
    .onConflictDoUpdate({
      target: [sets.game, sets.code],
      // card_count is ours (paper printings in the catalog), see refreshSetCounts().
      set: excluded(sets, [
        "name",
        "setType",
        "parentSetCode",
        "releasedAt",
        "iconUri",
        "printCode",
        "printedTotal",
      ]),
    });
}

/**
 * Attaches translated names to catalog cards by their source id (same card id in every
 * language, as in TCGdex). Names identical to the English one are skipped.
 */
export async function upsertNamesByExternalId(
  game: CatalogCardRow["game"],
  rows: Array<{ externalId: string; lang: string; printedName: string; searchName: string }>,
) {
  if (!rows.length) return;
  await pool.query(
    `insert into card_names (catalog_card_id, lang, printed_name, search_name)
     select distinct on (c.id, v.lang) c.id, v.lang, v.printed_name, v.search_name
     from unnest($2::text[], $3::text[], $4::text[], $5::text[])
       as v(external_id, lang, printed_name, search_name)
     join catalog_cards c on c.game = $1 and c.external_id = v.external_id
     where c.search_name <> v.search_name
     on conflict (catalog_card_id, lang) do update
       set printed_name = excluded.printed_name, search_name = excluded.search_name`,
    [
      game,
      rows.map((r) => r.externalId),
      rows.map((r) => r.lang),
      rows.map((r) => r.printedName),
      rows.map((r) => r.searchName),
    ],
  );
}

/** Recounts each set's paper printings in the catalog. Run after syncing cards. */
export async function refreshSetCounts() {
  await pool.query(
    `update sets s set card_count = c.n
     from (
       select s2.id, count(cc.id)::int as n
       from sets s2
       left join catalog_cards cc on cc.game = s2.game and cc.set_code = s2.code
       group by s2.id
     ) c
     where c.id = s.id and s.card_count is distinct from c.n`,
  );
}

export async function upsertCatalogCards(rows: CatalogCardRow[]) {
  if (!rows.length) return;
  await db
    .insert(catalogCards)
    .values(rows)
    .onConflictDoUpdate({
      target: [catalogCards.game, catalogCards.externalId],
      set: excluded(catalogCards, [
        "oracleId",
        "name",
        "searchName",
        "setCode",
        "collectorNumber",
        "rarity",
        "typeLine",
        "finishes",
        "imageSmall",
        "imageNormal",
        "releasedAt",
        "cardmarketId",
        "priceEur",
        "priceEurFoil",
        "priceUsd",
        "priceUsdFoil",
        "pricesUpdatedAt",
      ]),
    });
}

/**
 * Attaches translated names to the English printing with the same set and collector number.
 * Printings without an English counterpart in the catalog are dropped by the join.
 */
export async function upsertPrintedNames(rows: PrintedNameRow[]) {
  if (!rows.length) return;
  await pool.query(
    `insert into card_names (catalog_card_id, lang, printed_name, search_name)
     select distinct on (c.id, v.lang) c.id, v.lang, v.printed_name, v.search_name
     from unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[])
       as v(set_code, collector_number, lang, printed_name, search_name)
     join catalog_cards c
       on c.game = 'mtg' and c.set_code = v.set_code and c.collector_number = v.collector_number
     on conflict (catalog_card_id, lang) do update
       set printed_name = excluded.printed_name, search_name = excluded.search_name`,
    [
      rows.map((r) => r.setCode),
      rows.map((r) => r.collectorNumber),
      rows.map((r) => r.lang),
      rows.map((r) => r.printedName),
      rows.map((r) => r.searchName),
    ],
  );
}
