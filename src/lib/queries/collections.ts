import { and, asc, desc, eq, exists, isNull, like, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { cardNames, catalogCards, collections, items, locations, sets } from "@/db/schema";
import { unitPriceEurSql } from "@/lib/collection/pricing";
import { normalizeForSearch } from "@/lib/search/normalize";

/** Copies, value and unpriced copies, over `items` left-joined to `catalog_cards`. */
export const stackAggregates = {
  cardCount: sql<number>`coalesce(sum(${items.quantity}), 0)::int`,
  valueEur: sql<number>`coalesce(sum(${items.quantity} * ${unitPriceEurSql}), 0)::float8`,
  unpricedCount: sql<number>`coalesce(sum(${items.quantity}) filter (where ${items.id} is not null and ${unitPriceEurSql} is null), 0)::int`,
};

export async function listCollections(ownerId: string) {
  return db
    .select({
      id: collections.id,
      name: collections.name,
      description: collections.description,
      ...stackAggregates,
    })
    .from(collections)
    .leftJoin(items, eq(items.collectionId, collections.id))
    .leftJoin(catalogCards, eq(catalogCards.id, items.catalogCardId))
    .where(eq(collections.ownerId, ownerId))
    .groupBy(collections.id)
    .orderBy(asc(collections.name));
}

export async function getCollection(ownerId: string, id: string) {
  const [row] = await db
    .select({
      id: collections.id,
      name: collections.name,
      description: collections.description,
      ...stackAggregates,
    })
    .from(collections)
    .leftJoin(items, eq(items.collectionId, collections.id))
    .leftJoin(catalogCards, eq(catalogCards.id, items.catalogCardId))
    .where(and(eq(collections.ownerId, ownerId), eq(collections.id, id)))
    .groupBy(collections.id);
  return row ?? null;
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
  collectionId?: string;
  /** A location id, `null` for copies without location, or undefined for any. */
  locationId?: string | null;
}

/** The user's stacks within a collection and/or location, filtered, sorted and paginated. */
export async function listItems(
  scope: ItemScope,
  { q, sort = "value", page = 1 }: { q?: string; sort?: ItemSort; page?: number },
) {
  const filters: SQL[] = [eq(collections.ownerId, scope.ownerId)];
  if (scope.collectionId) filters.push(eq(items.collectionId, scope.collectionId));
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

  const orderBy = {
    value: [sql`${unitPriceEurSql} * ${items.quantity} desc nulls last`, asc(catalogCards.name)],
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
      createdAt: items.createdAt,
      unitPriceEur: sql<number | null>`${unitPriceEurSql}::float8`,
      collection: { id: collections.id, name: collections.name },
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
    .innerJoin(collections, eq(collections.id, items.collectionId))
    .leftJoin(locations, eq(locations.id, items.locationId))
    .leftJoin(catalogCards, eq(catalogCards.id, items.catalogCardId))
    .leftJoin(sets, and(eq(sets.game, catalogCards.game), eq(sets.code, catalogCards.setCode)))
    .where(and(...filters))
    .orderBy(...orderBy)
    .limit(ITEMS_PAGE_SIZE + 1)
    .offset((page - 1) * ITEMS_PAGE_SIZE);

  return { rows: rows.slice(0, ITEMS_PAGE_SIZE), hasMore: rows.length > ITEMS_PAGE_SIZE };
}

export type CollectionItem = Awaited<ReturnType<typeof listItems>>["rows"][number];
