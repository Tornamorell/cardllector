/**
 * Runs one SQL statement against DATABASE_URL and prints the rows. Dev helper, since the
 * local database is PGlite and there's no psql.
 *
 *   npm run sql -- "select count(*) from catalog_cards"
 */
import { pool } from "../src/db/client";

const statement = process.argv[2];
if (!statement) {
  console.error('Usage: npm run sql -- "<statement>"');
  process.exit(1);
}

try {
  const result = await pool.query(statement);
  if (result.rows.length) console.table(result.rows);
  else console.log(`${result.command} ${result.rowCount ?? ""}`);
} finally {
  await pool.end();
}
