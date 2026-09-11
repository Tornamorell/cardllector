/**
 * Daily Magic catalog + price sync from Scryfall's `default_cards` bulk file, followed by
 * the day's price snapshot. Run by GitHub Actions after Scryfall publishes (~09:05 UTC).
 *
 *   npm run sync:scryfall
 */
import { pool } from "../src/db/client";
import { refreshSetCounts, upsertCatalogCards, upsertSets } from "../src/lib/catalog/upsert";
import { snapshotPrices } from "../src/lib/prices/snapshot";
import { getAllSets, getBulkEntry, streamBulkLines } from "../src/lib/scryfall/client";
import { mapScryfallCard, mapScryfallSet, type CatalogCardRow } from "../src/lib/scryfall/map";
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

for await (const line of streamBulkLines(entry.jsonl_download_uri)) {
  const row = mapScryfallCard(JSON.parse(line) as ScryfallCard, pricesUpdatedAt);
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
await refreshSetCounts();
console.log(`Cards: ${upserted} upserted, ${skipped} digital-only skipped (${elapsed()})`);

const snapshot = await snapshotPrices(entry.updated_at.slice(0, 10));
console.log(
  `Snapshot ${entry.updated_at.slice(0, 10)}: ${snapshot.printings} printings, ` +
    `${snapshot.owners} inventories (${elapsed()})`,
);

await pool.end();
