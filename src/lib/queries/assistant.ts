// Reads behind the assistant's tools (D37): compact, capped, and always the asking user's own
// data. Every result carries the app paths the answer may link to.
import { and, asc, desc, eq, ilike, isNotNull, isNull, sql } from "drizzle-orm";
import { db, pool } from "@/db/client";
import {
  aiChatMessages,
  aiChatThreads,
  aiChatTurns,
  catalogCards,
  items,
  locationSections,
  locations,
  sets,
} from "@/db/schema";
import { MONTHLY_LIMIT_USD } from "@/lib/assistant/cost";
import { MAX_TURNS, type ChatTurn } from "@/lib/assistant/history";
import { parsePagePath } from "@/lib/assistant/page";
import { gameBySlug } from "@/lib/games";
import { itemValueEurSql } from "@/lib/collection/pricing";
import { toLine } from "@/lib/assistant/lines";
import { analyzeDeck } from "@/lib/decks/analysis";
import { BOARDS } from "@/lib/decks/decklist";
import { cardRoles, roleCounts, type Role } from "@/lib/decks/roles";
import { getCollection, listCollectionCards, listCollections } from "./collections";
import { boxContents, deckCardRows, getDeck, listDecks } from "./decks";
import { inventorySummary, itemFilters, stackAggregates } from "./items";
import { listLocations } from "./locations";
import { searchCards } from "./search";
import { priceMoves, valueHistory, type PriceMove, type ValuePeriod } from "./value";

const round2 = (n: number | null | undefined) => (n == null ? null : Math.round(n * 100) / 100);
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
const trimText = (text: string | null, max = 300) => (text && text.length > max ? `${text.slice(0, max)}…` : text);

/** Drops empty fields: every token the model reads is paid for. */
function compact<T extends Record<string, unknown>>(o: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(o).filter(([, v]) => v != null && v !== false && !(Array.isArray(v) && v.length === 0)),
  ) as Partial<T>;
}

/** What the user has spent on the assistant this calendar month, and their allowance. */
export async function assistantAllowance(ownerId: string) {
  const limitUsd = Number(process.env.AI_ASSISTANT_MONTHLY_USD) || MONTHLY_LIMIT_USD;
  const [row] = await db
    .select({ spent: sql<number>`coalesce(sum(${aiChatTurns.costUsd}), 0)::float8` })
    .from(aiChatTurns)
    .where(and(eq(aiChatTurns.ownerId, ownerId), sql`${aiChatTurns.createdAt} >= date_trunc('month', now())`));
  return { spentUsd: row.spent, limitUsd };
}

export type ThreadSummary = { id: string; title: string; updatedAt: Date };

/** The user's conversations, the latest first. */
export async function listThreads(ownerId: string): Promise<ThreadSummary[]> {
  return db
    .select({ id: aiChatThreads.id, title: aiChatThreads.title, updatedAt: aiChatThreads.updatedAt })
    .from(aiChatThreads)
    .where(eq(aiChatThreads.ownerId, ownerId))
    .orderBy(desc(aiChatThreads.updatedAt))
    .limit(100);
}

/** One of the user's conversations, or null if it isn't theirs. */
export async function threadOf(ownerId: string, id: string) {
  const [row] = await db
    .select({ id: aiChatThreads.id, title: aiChatThreads.title })
    .from(aiChatThreads)
    .where(and(eq(aiChatThreads.id, id), eq(aiChatThreads.ownerId, ownerId)));
  return row ?? null;
}

/** A conversation with all its messages, oldest first. */
export async function getThread(ownerId: string, id: string) {
  const thread = await threadOf(ownerId, id);
  if (!thread) return null;
  const messages: ChatTurn[] = await db
    .select({ role: aiChatMessages.role, content: aiChatMessages.content })
    .from(aiChatMessages)
    .where(eq(aiChatMessages.threadId, id))
    .orderBy(asc(aiChatMessages.id));
  return { ...thread, messages };
}

/** The last turns of a conversation, oldest first: what goes to the model with a new question. */
export async function threadHistory(threadId: string): Promise<ChatTurn[]> {
  const rows = await db
    .select({ role: aiChatMessages.role, content: aiChatMessages.content })
    .from(aiChatMessages)
    .where(eq(aiChatMessages.threadId, threadId))
    .orderBy(desc(aiChatMessages.id))
    .limit(MAX_TURNS);
  return rows.reverse();
}

const LIST_PAGES = {
  home: "the dashboard (the value of everything they own and how it moved)",
  inventory: "«Mis cartas», their inventory",
  decks: "the list of their decks",
  collections: "the list of their collections",
  locations: "the list of their locations",
  review: "the cards they saved to identify later",
  search: "the card search",
  catalog: "the catalog",
} as const;

/** What the user has open (a path from the chat), as a line for the model; null if nothing useful. */
export async function pageContext(ownerId: string, path: string): Promise<string | null> {
  const page = parsePagePath(path);
  if (!page) return null;
  const line = (what: string) => `[Page: the user is looking at ${what}.]`;
  switch (page.kind) {
    case "deck": {
      const deck = await getDeck(ownerId, page.id);
      return deck && line(`their deck «${deck.name}» (deck_id ${deck.id}, /decks/${deck.id})`);
    }
    case "collection": {
      const collection = await getCollection(ownerId, page.id);
      return collection && line(`their collection «${collection.name}» (collection_id ${page.id}, /collections/${page.id})`);
    }
    case "location": {
      if (page.id === "none") return line("their copies with no location (location_id none, /locations/none)");
      const [place] = await db
        .select({ name: locations.name })
        .from(locations)
        .where(and(eq(locations.id, page.id), eq(locations.ownerId, ownerId)));
      return place ? line(`their location «${place.name}» (location_id ${page.id}, /locations/${page.id})`) : null;
    }
    case "card": {
      const [card] = await db
        .select({ name: catalogCards.name, game: catalogCards.game, setCode: catalogCards.setCode, number: catalogCards.collectorNumber })
        .from(catalogCards)
        .where(eq(catalogCards.id, page.id));
      return card
        ? line(`the ${card.game} card «${card.name}», printing ${card.setCode.toUpperCase()} ${card.number} (/cards/${page.id})`)
        : null;
    }
    case "set": {
      const game = gameBySlug(page.gameSlug);
      if (!game) return null;
      const [set] = await db
        .select({ name: sets.name, code: sets.code })
        .from(sets)
        .where(and(eq(sets.game, game.id), eq(sets.code, page.setCode)));
      return set ? line(`the ${game.id} set «${set.name}» (set_code ${set.code}) in the catalog`) : null;
    }
    case "game": {
      const game = gameBySlug(page.gameSlug);
      return game && line(`the ${game.id} catalog`);
    }
    default:
      return line(LIST_PAGES[page.kind]);
  }
}

/** Totals, by game; collections with their progress; decks; locations. */
export async function overview(ownerId: string) {
  const [inventory, byGame, unlocated, collections, decks, places] = await Promise.all([
    inventorySummary(ownerId),
    db
      .select({ game: catalogCards.game, ...stackAggregates })
      .from(items)
      .leftJoin(catalogCards, eq(catalogCards.id, items.catalogCardId))
      .where(eq(items.ownerId, ownerId))
      .groupBy(catalogCards.game),
    db
      .select(stackAggregates)
      .from(items)
      .leftJoin(catalogCards, eq(catalogCards.id, items.catalogCardId))
      .where(and(eq(items.ownerId, ownerId), isNull(items.locationId))),
    listCollections(ownerId),
    listDecks(ownerId),
    listLocations(ownerId),
  ]);
  return {
    inventory: { copies: inventory.cardCount, valueEur: round2(inventory.valueEur), unpricedCopies: inventory.unpricedCount },
    byGame: byGame.map((g) => ({ game: g.game ?? "entered by hand", copies: g.cardCount, valueEur: round2(g.valueEur) })),
    collections: collections.map((c) => ({
      id: c.id,
      path: `/collections/${c.id}`,
      name: c.name,
      printings: c.cardCount,
      printingsComplete: c.completeCount,
      copiesWanted: c.wanted,
      copiesOwned: c.ownedCopies,
      ownedValueEur: round2(c.ownedValue),
      missingCostEur: round2(c.missingCost),
    })),
    decks: decks.map((d) => compact({ id: d.id, path: `/decks/${d.id}`, name: d.name, format: d.format, box: d.locationName })),
    locations: [
      ...places.map((l) => ({ id: l.id, path: `/locations/${l.id}`, name: l.name, copies: l.cardCount, valueEur: round2(l.valueEur) })),
      { id: "none", path: "/locations/none", name: "Sin ubicación", copies: unlocated[0].cardCount, valueEur: round2(unlocated[0].valueEur) },
    ],
  };
}

export type OwnedCardFilters = {
  query?: string;
  game?: "mtg" | "pokemon" | "sports";
  setCode?: string;
  rarity?: string;
  /** A location's id, or "none" for copies without one. */
  locationId?: string;
  minValueEur?: number;
  graded?: boolean;
  sort?: "value" | "name" | "recent";
  limit?: number;
};

/** The user's copies that match, and how many and how much all the matches are. */
export async function searchOwnedCards(ownerId: string, f: OwnedCardFilters) {
  const locationId = f.locationId === undefined ? undefined : f.locationId === "none" ? null : f.locationId;
  const where = and(
    ...itemFilters({ ownerId, locationId }, f.query),
    f.game ? eq(catalogCards.game, f.game) : undefined,
    f.setCode ? sql`lower(${catalogCards.setCode}) = lower(${f.setCode})` : undefined,
    f.rarity ? ilike(catalogCards.rarity, escapeLike(f.rarity)) : undefined,
    f.minValueEur != null ? sql`${itemValueEurSql} >= ${f.minValueEur}` : undefined,
    f.graded === true ? isNotNull(items.gradingCompany) : f.graded === false ? isNull(items.gradingCompany) : undefined,
  );
  const orderBy = {
    value: [sql`${itemValueEurSql} * ${items.quantity} desc nulls last`, asc(catalogCards.name)],
    name: [asc(catalogCards.name), asc(catalogCards.setCode)],
    recent: [desc(items.createdAt)],
  }[f.sort ?? "value"];
  const [rows, [totals]] = await Promise.all([
    db
      .select({
        printingId: catalogCards.id,
        name: catalogCards.name,
        game: catalogCards.game,
        setCode: catalogCards.setCode,
        setName: sets.name,
        number: catalogCards.collectorNumber,
        rarity: catalogCards.rarity,
        quantity: items.quantity,
        finish: items.finish,
        condition: items.condition,
        language: items.language,
        valueEur: sql<number | null>`${itemValueEurSql}::float8`,
        ownEstimate: sql<boolean>`${items.estimatedValueEur} is not null`,
        grading: items.gradingCompany,
        grade: items.grade,
        locationId: items.locationId,
        location: locations.name,
        section: locationSections.name,
        notes: items.notes,
        attributes: items.attributes,
      })
      .from(items)
      .leftJoin(catalogCards, eq(catalogCards.id, items.catalogCardId))
      .leftJoin(sets, and(eq(sets.game, catalogCards.game), eq(sets.code, catalogCards.setCode)))
      .leftJoin(locations, eq(locations.id, items.locationId))
      .leftJoin(locationSections, eq(locationSections.id, items.sectionId))
      .where(where)
      .orderBy(...orderBy)
      .limit(Math.min(f.limit ?? 10, 50)),
    db
      .select({ stacks: sql<number>`count(*)::int`, ...stackAggregates })
      .from(items)
      .leftJoin(catalogCards, eq(catalogCards.id, items.catalogCardId))
      .where(where),
  ]);
  // Lines, not objects (lines.ts); each location's path once, not on every line.
  const places: Record<string, string> = {};
  const cards = rows.map((r) => {
    const location = r.location ?? "Sin ubicación";
    places[location] = `/locations/${r.locationId ?? "none"}`;
    return toLine([
      r.quantity,
      r.name,
      r.setCode ? `${r.setName ?? r.setCode} (${r.setCode.toUpperCase()})` : null,
      r.number,
      r.rarity,
      r.finish,
      r.condition,
      r.language,
      r.valueEur == null ? null : `${round2(r.valueEur)}${r.ownEstimate ? " (own estimate)" : ""}`,
      r.grading ? `${r.grading} ${r.grade ?? ""}`.trim() : null,
      r.section ? `${location} › ${r.section}` : location,
      r.printingId ? `/cards/${r.printingId}` : null,
      r.attributes ? Object.entries(r.attributes).map(([k, v]) => `${k}: ${v}`).join(", ") : null,
      r.notes,
    ]);
  });
  return {
    matches: {
      stacks: totals.stacks,
      copies: totals.cardCount,
      valueEur: round2(totals.valueEur),
      unpricedCopies: totals.unpricedCount,
    },
    columns:
      "copies | name | set | number | rarity | finish | condition | language | € each | graded | location › divider | path | details | notes",
    cards,
    locationPaths: places,
  };
}

export type OwnedMagicFilters = {
  /** Colour identity within these (W U B R G); [] is colourless only. */
  colors?: string[];
  type?: string;
  text?: string;
  maxCmc?: number;
  role?: Role;
  /** Only cards with a copy outside every deck's box (default). */
  onlyFree?: boolean;
  /** Leave out the cards this deck already lists. */
  notInDeckId?: string;
  limit?: number;
};

/** The user's Magic cards by their rules, one row per card: for building and improving decks. */
export async function ownedMagicByRules(ownerId: string, f: OwnedMagicFilters) {
  const like = (s?: string) => (s ? `%${escapeLike(s)}%` : null);
  const { rows } = await pool.query<{
    oracleId: string;
    name: string;
    typeLine: string | null;
    manaCost: string | null;
    cmc: number;
    colorIdentity: string[];
    oracleText: string | null;
    producedMana: string[];
    commanderLegality: string | null;
    gameChanger: boolean;
    copies: number;
    freeCopies: number;
    places: string[];
    printingId: string;
  }>(
    `select o.oracle_id as "oracleId", o.name, o.type_line as "typeLine", o.mana_cost as "manaCost",
            o.cmc::float8 as cmc, o.color_identity as "colorIdentity", o.oracle_text as "oracleText",
            o.produced_mana as "producedMana", o.legalities->>'commander' as "commanderLegality",
            o.game_changer as "gameChanger",
            sum(i.quantity)::int as copies,
            coalesce(sum(i.quantity) filter (where od.id is null), 0)::int as "freeCopies",
            array_agg(distinct coalesce(od.name, l.name, 'Sin ubicación')) as places,
            (array_agg(c.id order by c.price_eur desc nulls last))[1] as "printingId"
     from items i
     join catalog_cards c on c.id = i.catalog_card_id and c.game = 'mtg'
     join oracle_cards o on o.oracle_id = c.oracle_id
     left join locations l on l.id = i.location_id
     left join decks od on od.location_id = i.location_id
     where i.owner_id = $1 and i.grading_company is null
       and ($2::text[] is null or o.color_identity <@ $2::text[])
       and ($3::text is null or o.type_line ilike $3)
       and ($4::text is null or o.oracle_text ilike $4)
       and ($5::float8 is null or o.cmc <= $5)
       and ($6::uuid is null or not exists (
         select 1 from deck_cards dc join decks d on d.id = dc.deck_id
         where dc.deck_id = $6 and d.owner_id = $1 and dc.oracle_id = o.oracle_id))
     group by o.oracle_id
     having not $7::boolean or coalesce(sum(i.quantity) filter (where od.id is null), 0) > 0
     order by o.name
     limit 500`,
    [
      ownerId,
      f.colors ? f.colors.map((c) => c.toUpperCase()) : null,
      like(f.type),
      like(f.text),
      f.maxCmc ?? null,
      f.notInDeckId ?? null,
      f.onlyFree ?? true,
    ],
  );
  const found = f.role ? rows.filter((r) => cardRoles(r).includes(f.role!)) : rows;
  // Lines, not objects (lines.ts), like get_deck's.
  return {
    found: found.length,
    columns: "name | type | mana cost | identity | roles | copies | free copies | where | notes | path | rules text",
    cards: found.slice(0, Math.min(f.limit ?? 30, 60)).map((r) =>
      toLine([
        r.name,
        r.typeLine,
        r.manaCost,
        r.colorIdentity.join("") || "C",
        cardRoles(r).join(" "),
        r.copies,
        r.freeCopies,
        r.places.join(", "),
        [r.gameChanger && "Game Changer", r.commanderLegality && r.commanderLegality !== "legal" && `commander: ${r.commanderLegality}`]
          .filter(Boolean)
          .join(", "),
        `/cards/${r.printingId}`,
        trimText(r.oracleText),
      ]),
    ),
  };
}

/** A collection (want-list) and its printings: all, the missing ones or the owned ones. */
export async function collectionDetail(ownerId: string, id: string, show: "all" | "missing" | "owned", limit = 100) {
  const collection = await getCollection(ownerId, id);
  if (!collection) return null;
  const cards = (await listCollectionCards(ownerId, id)).filter(
    (c) => show === "all" || (show === "missing" ? c.owned < c.wanted : c.owned > 0),
  );
  if (show === "missing") cards.sort((a, b) => (b.priceEur ?? 0) - (a.priceEur ?? 0));
  return {
    collection: {
      path: `/collections/${id}`,
      name: collection.name,
      description: collection.description,
      printings: collection.cardCount,
      printingsComplete: collection.completeCount,
      copiesWanted: collection.wanted,
      copiesOwned: collection.ownedCopies,
      ownedValueEur: round2(collection.ownedValue),
      missingCostEur: round2(collection.missingCost),
    },
    show,
    matching: cards.length,
    cards: cards.slice(0, Math.min(limit, 200)).map((c) =>
      compact({
        path: `/cards/${c.id}`,
        name: c.name,
        set: `${c.setName ?? c.setCode} (${c.setCode.toUpperCase()})`,
        number: c.collectorNumber,
        rarity: c.rarity,
        wanted: c.wanted,
        owned: c.owned,
        priceEur: round2(c.priceEur),
      }),
    ),
  };
}

const CURVE_LABELS = ["0", "1", "2", "3", "4", "5", "6", "7+"];

/** Where a played card's copies are, when not all in the deck's box; empty when they are. */
function missingFromBox(r: { quantity: number; inBox: number; free: number; freeWhere: string[]; inOtherDecks: number }) {
  if (r.inBox >= r.quantity) return null;
  const parts = [`${r.quantity - r.inBox} not in the box`];
  if (r.free > 0) parts.push(`${r.free} free in ${r.freeWhere.join(", ")}`);
  if (r.inOtherDecks > 0) parts.push(`${r.inOtherDecks} in other decks`);
  if (r.free <= 0 && r.inOtherDecks <= 0) parts.push("not owned");
  return parts.join(", ");
}

/** A deck: its analysis (as its page shows it), its cards and where their copies are. */
export async function deckDetail(ownerId: string, id: string, includeText: boolean) {
  const deck = await getDeck(ownerId, id);
  if (!deck) return null;
  const [rows, box] = await Promise.all([
    deckCardRows(ownerId, id),
    deck.locationId ? boxContents(ownerId, deck.locationId) : Promise.resolve([]),
  ]);
  const a = analyzeDeck(rows);
  const rolesOf = (r: (typeof rows)[number]) => (r.manualRoles as Role[] | null) ?? cardRoles(r);
  const listed = new Map<string, number>();
  for (const r of rows) listed.set(r.oracleId, (listed.get(r.oracleId) ?? 0) + r.quantity);
  const played = (board: string) => board === "commander" || board === "main";
  return {
    deck: compact({
      path: `/decks/${id}`,
      name: deck.name,
      format: deck.format,
      description: deck.description,
      box: deck.locationName,
      boxPath: deck.locationId ? `/locations/${deck.locationId}` : null,
    }),
    analysis: {
      cardsPlayed: a.size,
      copiesByBoard: a.copies,
      types: a.types,
      curve: Object.fromEntries(a.curve.map((n, i) => [CURVE_LABELS[i], n])),
      averageCmc: a.averageCmc == null ? null : Math.round(a.averageCmc * 100) / 100,
      mdfcLands: a.mdfcLands,
      colourSymbols: a.pips,
      landSources: a.landSources,
      otherSources: a.otherSources,
      commanderIdentity: a.identity,
      gameChangers: a.gameChangers,
      ruleIssues: a.issues,
      priceEur: round2(a.price),
      unpricedCopies: a.unpriced,
      roles: roleCounts(rows.map((r) => ({ board: r.board, quantity: r.quantity, roles: rolesOf(r) }))),
    },
    // One line per card, by board (lines.ts): as objects, a hundred cards took ~12,000 tokens.
    cardColumns: `copies | name | type | mana cost | roles | € each | path | notes | copies missing from the box (empty: all there)${includeText ? " | rules text" : ""}`,
    cards: Object.fromEntries(
      BOARDS.map((board) => [
        board,
        rows
          .filter((r) => r.board === board)
          .map((r) =>
            toLine([
              r.quantity,
              r.name,
              r.typeLine,
              r.manaCost,
              rolesOf(r).join(" "),
              round2(r.priceEur),
              r.printingId ? `/cards/${r.printingId}` : null,
              [r.gameChanger && "Game Changer", r.commanderLegality && r.commanderLegality !== "legal" && `commander: ${r.commanderLegality}`]
                .filter(Boolean)
                .join(", "),
              played(r.board) ? missingFromBox(r) : null,
              includeText ? trimText(r.oracleText) : null,
            ]),
          ),
      ]).filter(([, lines]) => lines.length),
    ),
    inBoxButNotListed: box
      .filter((b) => b.copies > (listed.get(b.oracleId) ?? 0))
      .map((b) => ({ name: b.name, extraCopies: b.copies - (listed.get(b.oracleId) ?? 0) })),
  };
}

/** How the inventory's value moved over a period, and which prices moved it. */
export async function valueReport(ownerId: string, period: ValuePeriod) {
  const [history, moves] = await Promise.all([valueHistory(ownerId, period), priceMoves(ownerId, period, 8)]);
  const step = Math.max(1, Math.ceil(history.length / 20));
  const point = (p: (typeof history)[number]) => ({ date: p.date, valueEur: round2(p.valueEur), copies: p.cardCount });
  const move = (m: PriceMove) =>
    compact({
      path: `/cards/${m.id}`,
      name: m.name,
      set: m.setCode.toUpperCase(),
      number: m.collectorNumber,
      finish: m.finish,
      copies: m.quantity,
      fromEur: round2(m.thenEur),
      nowEur: round2(m.nowEur),
      impactEur: m.impact,
    });
  return {
    period: period === "all" ? "all" : `${period} days`,
    note: "The value also moves when cards are added or removed; priceEffect is the part due to price changes.",
    points: history.filter((_, i) => i % step === 0 || i === history.length - 1).map(point),
    priceEffect: {
      sinceDate: moves.fromDate,
      totalImpactEur: moves.totalImpact,
      baseValueEur: moves.baseValue,
      comparedPrintings: moves.compared,
      up: moves.up.map(move),
      down: moves.down.map(move),
    },
  };
}

/** Cards in the catalog by name (English or Spanish): rules, printings with prices, and copies owned. */
export async function catalogLookup(ownerId: string, query: string) {
  const results = await searchCards(query, 5);
  if (!results.length) return { results: [] };
  const ids = results.map((r) => r.oracleId);
  const [rules, printings, owned] = await Promise.all([
    pool.query<{
      oracleId: string;
      typeLine: string | null;
      manaCost: string | null;
      colorIdentity: string[];
      oracleText: string | null;
      commander: string | null;
      gameChanger: boolean;
    }>(
      `select oracle_id as "oracleId", type_line as "typeLine", mana_cost as "manaCost",
              color_identity as "colorIdentity", oracle_text as "oracleText",
              legalities->>'commander' as commander, game_changer as "gameChanger"
       from oracle_cards where oracle_id = any($1)`,
      [ids],
    ),
    pool.query<{
      oracleId: string;
      id: string;
      setCode: string;
      setName: string | null;
      number: string;
      rarity: string | null;
      eur: number | null;
      eurFoil: number | null;
      released: string | null;
    }>(
      `select c.oracle_id as "oracleId", c.id, c.set_code as "setCode", s.name as "setName",
              c.collector_number as number, c.rarity, c.price_eur::float8 as eur,
              c.price_eur_foil::float8 as "eurFoil", c.released_at::text as released
       from catalog_cards c
       left join sets s on s.game = c.game and s.code = c.set_code
       where c.oracle_id = any($1)
       order by c.released_at desc nulls last, c.collector_number`,
      [ids],
    ),
    pool.query<{ oracleId: string; copies: number }>(
      `select c.oracle_id as "oracleId", sum(i.quantity)::int as copies
       from items i join catalog_cards c on c.id = i.catalog_card_id
       where i.owner_id = $2 and c.oracle_id = any($1)
       group by c.oracle_id`,
      [ids, ownerId],
    ),
  ]);
  return {
    results: results.map((r) => {
      const rule = rules.rows.find((x) => x.oracleId === r.oracleId);
      const mine = printings.rows.filter((p) => p.oracleId === r.oracleId);
      const prices = mine.map((p) => p.eur).filter((p): p is number => p != null);
      return compact({
        name: r.name,
        spanishName: r.printedName,
        game: r.game,
        path: `/cards/${r.printingId}`,
        copiesOwned: owned.rows.find((o) => o.oracleId === r.oracleId)?.copies ?? 0,
        rules: rule
          ? compact({
              type: rule.typeLine,
              cost: rule.manaCost,
              identity: rule.colorIdentity.join("") || "C",
              text: trimText(rule.oracleText, 600),
              commanderLegality: rule.commander,
              gameChanger: rule.gameChanger,
            })
          : null,
        printings: mine.length,
        cheapestEur: prices.length ? round2(Math.min(...prices)) : null,
        newestPrintings: mine.slice(0, 5).map((p) =>
          compact({
            path: `/cards/${p.id}`,
            set: `${p.setName ?? p.setCode} (${p.setCode.toUpperCase()})`,
            number: p.number,
            rarity: p.rarity,
            released: p.released,
            eur: round2(p.eur),
            eurFoil: round2(p.eurFoil),
          }),
        ),
      });
    }),
  };
}
