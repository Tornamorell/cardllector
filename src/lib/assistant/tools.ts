// The assistant's tools (D37): read-only lookups in the asking user's own data, each one a
// query in src/lib/queries/assistant.ts. The user's id is bound here, never taken from the
// model. Server only.
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { ROLES } from "@/lib/decks/roles";
import {
  catalogLookup,
  collectionDetail,
  deckDetail,
  overview,
  ownedMagicByRules,
  searchOwnedCards,
  valueReport,
} from "@/lib/queries/assistant";

const id = (what: string) => z.uuid().describe(`The ${what}'s id, from an earlier result`);

/**
 * The JSON Schema the SDK builds from zod is long-winded: each described field behind a `$ref`,
 * a `$schema` URL, and a 150-character regex on every uuid. The model reads it on every question
 * — most of the cached prefix — so it's flattened here; input is still validated with zod.
 */
function leanSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const defs = (schema.$defs ?? {}) as Record<string, unknown>;
  const inline = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(inline);
    if (!node || typeof node !== "object") return node;
    const { $ref, ...rest } = node as Record<string, unknown>;
    const target = typeof $ref === "string" ? defs[$ref.replace("#/$defs/", "")] : undefined;
    const merged: Record<string, unknown> = { ...(target && typeof target === "object" ? target : {}), ...rest };
    if (merged.format === "uuid") delete merged.pattern;
    for (const [key, value] of Object.entries(merged)) merged[key] = inline(value);
    return merged;
  };
  const body = { ...schema };
  delete body.$schema;
  delete body.$defs;
  return inline(body) as Record<string, unknown>;
}

/** The tools for one user; `onUse` hears each call, for the chat's «Buscando…» line. */
export function assistantTools(ownerId: string, onUse: (tool: string) => void) {
  const tool = <S extends z.ZodObject>(
    name: string,
    description: string,
    inputSchema: S,
    run: (input: z.infer<S>) => Promise<unknown>,
  ) => {
    const t = betaZodTool({
      name,
      description,
      inputSchema,
      run: async (input) => {
        onUse(name);
        try {
          const result = JSON.stringify((await run(input)) ?? { error: "Not found among this user's data." });
          // Each lookup's size, in Vercel's logs: it's re-sent on every later step of the answer.
          console.info(`[assistant] ${name}: ${result.length} characters`);
          return result;
        } catch (error) {
          console.error(`[assistant] ${name}`, error);
          return JSON.stringify({ error: "That lookup failed." });
        }
      },
    });
    // Always a custom tool with an input_schema; the SDK's type also allows its built-in ones.
    const custom = t as unknown as { input_schema: Record<string, unknown> };
    custom.input_schema = leanSchema(custom.input_schema);
    return t;
  };

  return [
    tool(
      "overview",
      "The user's totals: copies and value of everything they own, by game; their collections (want-lists) with progress and what completing them would cost; their decks; their locations with copies and value. Start here for a general picture or to get ids.",
      z.object({}),
      () => overview(ownerId),
    ),
    tool(
      "search_my_cards",
      "Search the copies the user owns, with filters. Returns how many copies match and their total value, and the matching stacks (printing, copies, finish, condition, language, value each, location). Leave the filters empty to list the most valuable copies.",
      z.object({
        query: z.string().optional().describe("Part of the card's name, in English or Spanish"),
        game: z.enum(["mtg", "pokemon", "sports"]).optional(),
        set_code: z.string().optional().describe("A set code, e.g. 'lcc' or 'sv03.5'"),
        rarity: z.string().optional().describe("As the catalog names it, e.g. 'mythic', 'Double Rare'"),
        location_id: z.union([z.uuid(), z.literal("none")]).optional().describe("A location's id, or 'none' for copies with no location"),
        min_value_eur: z.number().optional().describe("Only copies worth at least this each"),
        graded: z.boolean().optional(),
        sort: z.enum(["value", "name", "recent"]).optional().describe("'value' (default): most valuable first"),
        limit: z.number().int().min(1).max(50).optional().describe("Stacks to return, 10 by default"),
      }),
      (i) =>
        searchOwnedCards(ownerId, {
          query: i.query,
          game: i.game,
          setCode: i.set_code,
          rarity: i.rarity,
          locationId: i.location_id,
          minValueEur: i.min_value_eur,
          graded: i.graded,
          sort: i.sort,
          limit: i.limit,
        }),
    ),
    tool(
      "find_owned_magic_cards",
      "Find Magic cards the user owns by their rules, one row per card, with their text, roles and where the copies are. For building or improving a deck: e.g. the ramp they own in a commander's colours that isn't in another deck.",
      z.object({
        colors: z
          .array(z.enum(["W", "U", "B", "R", "G"]))
          .optional()
          .describe("Colour identity within these colours (a commander's identity); [] for colourless only"),
        type: z.string().optional().describe("Part of the type line, e.g. 'Creature', 'Dinosaur', 'Artifact'"),
        text: z.string().optional().describe("Part of the rules text, e.g. 'draw a card', 'treasure'"),
        max_cmc: z.number().optional(),
        role: z.enum(ROLES).optional().describe("What it does, as the deck analysis counts it"),
        only_free: z.boolean().optional().describe("Only cards with a copy outside every deck's box (default true)"),
        not_in_deck_id: z.uuid().optional().describe("Leave out cards this deck already has"),
        limit: z.number().int().min(1).max(60).optional().describe("30 by default"),
      }),
      (i) =>
        ownedMagicByRules(ownerId, {
          colors: i.colors,
          type: i.type,
          text: i.text,
          maxCmc: i.max_cmc,
          role: i.role,
          onlyFree: i.only_free,
          notInDeckId: i.not_in_deck_id,
          limit: i.limit,
        }),
    ),
    tool(
      "get_collection",
      "One of the user's collections (a want-list of printings with the copies wanted): its progress and its printings, with copies wanted and owned and today's price. 'missing' lists the dearest first.",
      z.object({
        collection_id: id("collection"),
        show: z.enum(["all", "missing", "owned"]).optional().describe("'all' by default"),
        limit: z.number().int().min(1).max(200).optional().describe("100 by default"),
      }),
      (i) => collectionDetail(ownerId, i.collection_id, i.show ?? "all", i.limit),
    ),
    tool(
      "get_deck",
      "One of the user's Magic decks (Commander): its analysis as its page shows it (mana curve, types, colour symbols against sources, roles such as ramp and draw, Commander rule issues, Game Changers, price) and its cards, with whether each card's copies are in the deck's box, free elsewhere, in another deck or missing.",
      z.object({
        deck_id: id("deck"),
        include_text: z.boolean().optional().describe("Also each card's rules text: for synergy questions; costs more"),
      }),
      (i) => deckDetail(ownerId, i.deck_id, i.include_text ?? false),
    ),
    tool(
      "value_report",
      "How the value of everything the user owns moved over a period (daily points), and which cards' prices moved it most, up and down.",
      z.object({ period: z.enum(["7", "30", "90", "all"]).describe("Days, or 'all'") }),
      (i) => valueReport(ownerId, i.period),
    ),
    tool(
      "search_catalog",
      "Look cards up in the catalog by name, in English or Spanish, owned or not: rules (Magic), newest printings with their Cardmarket prices, and how many copies the user owns.",
      z.object({ query: z.string().min(2).describe("The card's name or part of it") }),
      (i) => catalogLookup(ownerId, i.query),
    ),
  ];
}
