import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// Locally DATABASE_URL comes from .env.local; elsewhere (CI, Vercel) from the environment.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
  strict: true,
});
