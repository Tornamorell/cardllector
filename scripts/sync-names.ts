/**
 * Weekly sync of translated card names from Scryfall's `all_cards` bulk file (~400 MB
 * compressed). Names rarely change, so this doesn't need to run daily. Requires the
 * catalog to be synced first (npm run sync:scryfall).
 *
 *   npm run sync:names
 */
import { pool } from "../src/db/client";
import { upsertPrintedNames } from "../src/lib/catalog/upsert";
import { getBulkEntry, streamBulkLines } from "../src/lib/scryfall/client";
import { mapPrintedName, type PrintedNameRow } from "../src/lib/scryfall/map";
import type { ScryfallCard } from "../src/lib/scryfall/types";

const LANGS = ["es"];
const BATCH_SIZE = 2000;
const started = Date.now();
const elapsed = () => `${Math.round((Date.now() - started) / 1000)}s`;

const entry = await getBulkEntry("all_cards");
console.log(`Downloading all_cards from ${entry.updated_at}`);

// Cheap substring test before JSON.parse: most lines are other languages.
const markers = LANGS.map((lang) => `"lang":"${lang}"`);

let batch: PrintedNameRow[] = [];
let found = 0;
let lines = 0;

for await (const line of streamBulkLines(entry.jsonl_download_uri)) {
  if (++lines % 100_000 === 0) console.log(`  ${lines} lines read, ${found} names (${elapsed()})`);
  if (!markers.some((m) => line.includes(m))) continue;

  const row = mapPrintedName(JSON.parse(line) as ScryfallCard);
  if (!row || !LANGS.includes(row.lang)) continue;

  batch.push(row);
  found++;
  if (batch.length === BATCH_SIZE) {
    await upsertPrintedNames(batch);
    batch = [];
  }
}
await upsertPrintedNames(batch);

const { rows } = await pool.query<{ lang: string; count: string }>(
  "select lang, count(*) from card_names group by lang",
);
console.log(`Printed names found: ${found} (${elapsed()})`);
for (const r of rows) console.log(`  ${r.lang}: ${r.count} printings matched in catalog`);

await pool.end();
