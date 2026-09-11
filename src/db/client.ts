import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pool?: Pool };

// Reuse the pool across hot reloads in dev so we don't leak connections.
const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: process.env.NODE_ENV === "production" ? 5 : 3,
  });

if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

// On Vercel, keep the function instance alive until idle connections are released, so
// suspended instances don't leave connections hanging on Neon.
if (process.env.VERCEL) attachDatabasePool(pool);

export const db = drizzle(pool, { schema });
export type Db = typeof db;
export { pool };
