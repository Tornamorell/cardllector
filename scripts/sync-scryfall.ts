/**
 * Daily Magic catalog + price sync from Scryfall's `default_cards` bulk file, followed by
 * the day's price snapshot. Run by GitHub Actions after Scryfall publishes (~09:05 UTC).
 * The same pass keeps each card's rules data (oracle_cards) for deck analysis (D35).
 *
 *   npm run sync:scryfall
 */
import { pool } from "../src/db/client";
import {
  refreshSetCounts,
  upsertCatalogCards,
  upsertOracleCards,
  upsertSets,
} from "../src/lib/catalog/upsert";
import { snapshotPrices } from "../src/lib/prices/snapshot";
import { getAllSets, getBulkEntry, streamBulkLines } from "../src/lib/scryfall/client";
import {
  mapOracleCard,
  mapScryfallCard,
  mapScryfallSet,
  type CatalogCardRow,
  type OracleCardRow,
} from "../src/lib/scryfall/map";
import type { ScryfallCard } from "../src/lib/scryfall/types";

const BATCH_SIZE = 1000;
const started = Date.now();
const elapsed = () => `${Math.round((Date.now() - started) / 1000)}s`;

const setRows = (await getAllSets()).map(mapScryfallSet).filter((s) => s !== null);
await upsertSets(setRows);
console.log(`Sets: ${setRows.length}`);

const entry = await getBulkEntry("default_cards");
const pricesUpdatedAt = new Date(entry.updated_at);
console.log(`Downloading default_cards from ${entry.updated_at} (${entry.jsonl_download_uri})`);

let batch: CatalogCardRow[] = [];
let upserted = 0;
let skipped = 0;
let oracleBatch: OracleCardRow[] = [];
const seenOracles = new Set<string>();

for await (const line of streamBulkLines(entry.jsonl_download_uri)) {
  const card = JSON.parse(line) as ScryfallCard;

  // A card's rules side once, from its first paper printing: the same in all of them.
  const oracle = card.digital ? null : mapOracleCard(card);
  if (oracle && !seenOracles.has(oracle.oracleId)) {
    seenOracles.add(oracle.oracleId);
    oracleBatch.push(oracle);
    if (oracleBatch.length === BATCH_SIZE) {
      await upsertOracleCards(oracleBatch);
      oracleBatch = [];
    }
  }

  const row = mapScryfallCard(card, pricesUpdatedAt);
  if (!row) {
    skipped++;
    continue;
  }
  batch.push(row);
  if (batch.length === BATCH_SIZE) {
    await upsertCatalogCards(batch);
    upserted += batch.length;
    batch = [];
    if (upserted % 20_000 === 0) console.log(`  ${upserted} cards (${elapsed()})`);
  }
}
await upsertCatalogCards(batch);
upserted += batch.length;
await upsertOracleCards(oracleBatch);
await refreshSetCounts();
console.log(`Cards: ${upserted} upserted, ${skipped} digital-only skipped (${elapsed()})`);
console.log(`Oracle cards: ${seenOracles.size}`);

const snapshot = await snapshotPrices(entry.updated_at.slice(0, 10));
console.log(
  `Snapshot ${entry.updated_at.slice(0, 10)}: ${snapshot.printings} printings, ` +
    `${snapshot.owners} inventories (${elapsed()})`,
);

await pool.end();
