import { and, asc, desc, eq, exists, isNull, like, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { cardNames, catalogCards, items, locations, sets } from "@/db/schema";
import { itemValueEurSql } from "@/lib/collection/pricing";
import { normalizeForSearch } from "@/lib/search/normalize";

/** Copies, value and unpriced copies, over `items` left-joined to `catalog_cards`. */
export const stackAggregates = {
  cardCount: sql<number>`coalesce(sum(${items.quantity}), 0)::int`,
  valueEur: sql<number>`coalesce(sum(${items.quantity} * ${itemValueEurSql}), 0)::float8`,
  unpricedCount: sql<number>`coalesce(sum(${items.quantity}) filter (where ${items.id} is not null and ${itemValueEurSql} is null), 0)::int`,
};

/** The whole inventory: what the user owns, whatever collections or locations say. */
export async function inventorySummary(ownerId: string) {
  const [row] = await db
    .select(stackAggregates)
    .from(items)
    .leftJoin(catalogCards, eq(catalogCards.id, items.catalogCardId))
    .where(eq(items.ownerId, ownerId));
  return row;
}

export const ITEM_SORTS = {
  value: "Valor",
  name: "Nombre",
  recent: "Recientes",
  set: "Edición",
} as const;
export type ItemSort = keyof typeof ITEM_SORTS;

export const ITEMS_PAGE_SIZE = 100;

export interface ItemScope {
  ownerId: string;
  /** A location id, `null` for copies without location, or undefined for any. */
  locationId?: string | null;
}

/**
 * WHERE clauses for the user's stacks within a scope, optionally matching a name (English or
 * Spanish). Shared by the inventory list and by "add what's filtered to a collection".
 */
export function itemFilters(scope: ItemScope, q?: string): SQL[] {
  const filters: SQL[] = [eq(items.ownerId, scope.ownerId)];
  if (scope.locationId !== undefined) {
    filters.push(scope.locationId ? eq(items.locationId, scope.locationId) : isNull(items.locationId));
  }
  const needle = q ? normalizeForSearch(q) : "";
  if (needle) {
    const pattern = `%${needle.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    filters.push(
      or(
        like(catalogCards.searchName, pattern),
        exists(
          db
            .select({ one: sql`1` })
            .from(cardNames)
            .where(
              and(eq(cardNames.catalogCardId, catalogCards.id), like(cardNames.searchName, pattern)),
            ),
        ),
      )!,
    );
  }
  return filters;
}

/** The user's stacks, filtered, sorted and paginated. */
export async function listItems(
  scope: ItemScope,
  { q, sort = "value", page = 1 }: { q?: string; sort?: ItemSort; page?: number },
) {
  const orderBy = {
    value: [sql`${itemValueEurSql} * ${items.quantity} desc nulls last`, asc(catalogCards.name)],
    name: [asc(catalogCards.name), asc(catalogCards.setCode)],
    recent: [desc(items.createdAt)],
    set: [desc(catalogCards.releasedAt), asc(catalogCards.setCode), asc(catalogCards.collectorNumber)],
  }[sort];

  const rows = await db
    .select({
      id: items.id,
      quantity: items.quantity,
      finish: items.finish,
      condition: items.condition,
      language: items.language,
      locationId: items.locationId,
      notes: items.notes,
      purchasePriceEur: items.purchasePriceEur,
      estimatedValueEur: items.estimatedValueEur,
      gradingCompany: items.gradingCompany,
      grade: items.grade,
      certNumber: items.certNumber,
      createdAt: items.createdAt,
      /** Per copy: the estimate if set, else the market price (D27). */
      unitPriceEur: sql<number | null>`${itemValueEurSql}::float8`,
      location: { id: locations.id, name: locations.name },
      card: {
        id: catalogCards.id,
        game: catalogCards.game,
        name: catalogCards.name,
        setCode: catalogCards.setCode,
        setName: sets.name,
        collectorNumber: catalogCards.collectorNumber,
        rarity: catalogCards.rarity,
        finishes: catalogCards.finishes,
        imageSmall: catalogCards.imageSmall,
      },
    })
    .from(items)
    .leftJoin(locations, eq(locations.id, items.locationId))
    .leftJoin(catalogCards, eq(catalogCards.id, items.catalogCardId))
    .leftJoin(sets, and(eq(sets.game, catalogCards.game), eq(sets.code, catalogCards.setCode)))
    .where(and(...itemFilters(scope, q)))
    .orderBy(...orderBy)
    .limit(ITEMS_PAGE_SIZE + 1)
    .offset((page - 1) * ITEMS_PAGE_SIZE);

  return { rows: rows.slice(0, ITEMS_PAGE_SIZE), hasMore: rows.length > ITEMS_PAGE_SIZE };
}

export type InventoryItem = Awaited<ReturnType<typeof listItems>>["rows"][number];

/** Printings the user owns (all finishes), for marking which cards of a list are owned. */
export function ownedByPrinting(ownerId: string) {
  return sql`(
    select ${items.catalogCardId} as catalog_card_id,
           sum(${items.quantity})::int as qty,
           coalesce(sum(${items.quantity} * ${itemValueEurSql}), 0)::float8 as value
    from ${items}
    left join ${catalogCards} on ${catalogCards.id} = ${items.catalogCardId}
    where ${items.ownerId} = ${ownerId} and ${items.catalogCardId} is not null
    group by ${items.catalogCardId}
  )`;
}
