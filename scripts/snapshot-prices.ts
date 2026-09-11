/**
 * Records the price snapshot without re-downloading the catalog (sync:scryfall already does
 * this after each sync). Useful to backfill a day or to test the history views.
 *
 *   npm run snapshot:prices -- [YYYY-MM-DD]
 */
import { pool } from "../src/db/client";
import { snapshotPrices } from "../src/lib/prices/snapshot";

const date = process.argv[2] ?? new Date().toISOString().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error("Usage: npm run snapshot:prices -- [YYYY-MM-DD]");
  process.exit(1);
}

const result = await snapshotPrices(date);
console.log(`Snapshot ${date}: ${result.printings} printings, ${result.owners} inventories`);
await pool.end();
