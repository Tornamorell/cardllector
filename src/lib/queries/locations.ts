import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { catalogCards, collections, items, locations } from "@/db/schema";
import { stackAggregates } from "./collections";

/** For pickers: the user's locations, alphabetical. */
export async function locationOptions(ownerId: string) {
  return db
    .select({ id: locations.id, name: locations.name })
    .from(locations)
    .where(eq(locations.ownerId, ownerId))
    .orderBy(asc(locations.name));
}

export async function listLocations(ownerId: string) {
  return db
    .select({
      id: locations.id,
      name: locations.name,
      description: locations.description,
      ...stackAggregates,
    })
    .from(locations)
    .leftJoin(items, eq(items.locationId, locations.id))
    .leftJoin(catalogCards, eq(catalogCards.id, items.catalogCardId))
    .where(eq(locations.ownerId, ownerId))
    .groupBy(locations.id)
    .orderBy(asc(locations.name));
}

/** Totals for copies with no location yet. */
export async function unlocatedSummary(ownerId: string) {
  const [row] = await db
    .select(stackAggregates)
    .from(items)
    .innerJoin(collections, eq(collections.id, items.collectionId))
    .leftJoin(catalogCards, eq(catalogCards.id, items.catalogCardId))
    .where(and(eq(collections.ownerId, ownerId), isNull(items.locationId)));
  return row;
}

export async function getLocation(ownerId: string, id: string) {
  const [row] = await db
    .select({
      id: locations.id,
      name: locations.name,
      description: locations.description,
      ...stackAggregates,
    })
    .from(locations)
    .leftJoin(items, eq(items.locationId, locations.id))
    .leftJoin(catalogCards, eq(catalogCards.id, items.catalogCardId))
    .where(and(eq(locations.ownerId, ownerId), eq(locations.id, id)))
    .groupBy(locations.id);
  return row ?? null;
}

/** What a location holds, per collection. `null` = copies without location. */
export async function locationByCollection(ownerId: string, locationId: string | null) {
  return db
    .select({ id: collections.id, name: collections.name, ...stackAggregates })
    .from(items)
    .innerJoin(collections, eq(collections.id, items.collectionId))
    .leftJoin(catalogCards, eq(catalogCards.id, items.catalogCardId))
    .where(
      and(
        eq(collections.ownerId, ownerId),
        locationId ? eq(items.locationId, locationId) : isNull(items.locationId),
      ),
    )
    .groupBy(collections.id)
    .orderBy(asc(collections.name));
}

/** Where a collection's copies are, per location (id null = without location). */
export async function collectionByLocation(collectionId: string) {
  return db
    .select({ id: locations.id, name: locations.name, ...stackAggregates })
    .from(items)
    .leftJoin(locations, eq(locations.id, items.locationId))
    .leftJoin(catalogCards, eq(catalogCards.id, items.catalogCardId))
    .where(eq(items.collectionId, collectionId))
    .groupBy(locations.id)
    .orderBy(sql`${locations.name} nulls last`);
}
