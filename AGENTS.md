<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Cardllector — guide for agents

Personal trading-card collection tracker (Magic now, Pokémon next, sports later): catalog,
prices (Cardmarket €), the owner's cards (inventory, with optional physical locations),
collections as curated want-lists (D23) and value over time. The owner and a few colleagues, with
`admin`/`user` roles (D34). Next.js 16 +
Drizzle + Postgres (Neon in prod, PGlite locally) + Better Auth; catalog data from bulk sources
synced by GitHub Actions.

**Start with [`docs/README.md`](docs/README.md)** — index of architecture, data model, data
sources, decisions and roadmap.

## Documentation is part of every change

- Keep `docs/` true: if you change behaviour a doc describes, update the doc in the same change.
- **Every decision is provisional.** Record new ones — and changes to old ones — in
  `docs/decisions.md` (context, decision, discarded alternatives, when to revisit). Don't treat a
  past decision as a constraint to defend: if the need has changed, propose changing it.
- When you finish or re-plan work, update `docs/roadmap.md`. When you verify something about an
  external source, update `docs/data-sources.md` with the date.
- `docs/` is written in Spanish; code, identifiers and comments in English; UI text in Spanish.
  **Exception: card-game terminology stays in English** as collectors use it — rarities
  ("Double Rare", "Mythic"), not "Rara doble"/"Mítica" (D21).

## Git

- The owner allows agents to **commit every finished change** without asking, once typecheck,
  lint and tests pass (and `next build` for structural changes). Never commit secrets:
  `.env*` files are ignored; check the staged diff.
- **Pushing is done by the owner.** `main` deploys to production on Vercel.

## Conventions

- Every page and server action calls `requireUser()` (`src/lib/session.ts`); actions also check
  ownership of the item, collection or location. Admin-only pages and actions call
  `requireAdmin()` instead (roles, D34). `src/proxy.ts` is only an optimistic redirect; `/api/*`
  routes check the session themselves and return 401.
- Never call external catalog APIs (Scryfall, TCGdex…) from a user request path — search and
  scan hit our DB. Source clients live in `src/lib/<source>/`, sync jobs in `scripts/`.
- Per-game specifics (URL slug, rarities, set grouping) live in `src/lib/games.ts`.
- Price logic exists in TS/SQL twins in `src/lib/collection/pricing.ts`: `unitPriceEur()` /
  `unitPriceEurSql` (market price per finish) and `itemValueEur()` / `itemValueEurSql` (a copy's
  value: the user's estimate if set, else market — use this one for anything owned, D27).
  Change twins together.
- Reads live in `src/lib/queries/`, mutations in `actions.ts` next to their route.
- shadcn/ui here is the Base UI flavour: use the `render` prop, not `asChild`; style links as
  buttons with `buttonVariants()`.
- Pure logic gets Vitest tests next to it (`*.test.ts`).

## Commands

| Command | What it does |
| --- | --- |
| `npm run db:dev` | Local Postgres (PGlite) on :5433 — keep it running |
| `npm run db:migrate` / `npm run db:generate` | Apply / generate Drizzle migrations |
| `npm run dev` | Next.js dev server |
| `npm test` · `npm run typecheck` · `npm run lint` | Checks — run all three before finishing |
| `npm run sql -- "<query>"` | Query the local DB (there's no psql) |
| `npm run sync:scryfall` · `npm run sync:names` | Magic catalog + prices · Spanish names |
| `npm run sync:pokemon` (`-- --owned-only`) | Pokémon from TCGdex: full ~20 min · only owned prices |
| `npm run import:album -- <album>` | Football album from `data/albums/<album>.{json,txt}` (D29) |
| `npm run seed:user -- <email> <password> [name] [role]` | Create an account (admin by default); colleagues are created in `/admin` (D34) |

After adding or renaming routes, run `npx next typegen` so `PageProps<"/route">` types exist.
