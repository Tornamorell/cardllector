import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { catalogCards, items, locations } from "@/db/schema";
import { stackAggregates } from "./items";

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
    .leftJoin(catalogCards, eq(catalogCards.id, items.catalogCardId))
    .where(and(eq(items.ownerId, ownerId), isNull(items.locationId)));
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
