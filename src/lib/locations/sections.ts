import { and, asc, eq, gt, max, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { items, locationSections, locations } from "@/db/schema";

// Dividers inside a location (D28). Server-side helpers for the actions; they don't check the
// session, callers do.

export type Section = { id: string; name: string; position: number; capacity: number | null };

const sectionColumns = {
  id: locationSections.id,
  name: locationSections.name,
  position: locationSections.position,
  capacity: locationSections.capacity,
};

/** A divider, if it's the user's and belongs to that location. */
export async function ownedSection(
  ownerId: string,
  sectionId: string,
  locationId: string | null,
): Promise<Section | null> {
  if (!locationId) return null;
  const [row] = await db
    .select(sectionColumns)
    .from(locationSections)
    .innerJoin(locations, eq(locations.id, locationSections.locationId))
    .where(
      and(
        eq(locationSections.id, sectionId),
        eq(locationSections.locationId, locationId),
        eq(locations.ownerId, ownerId),
      ),
    );
  return row ?? null;
}

/** Copies in a divider. */
export async function sectionCount(sectionId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`coalesce(sum(${items.quantity}), 0)::int` })
    .from(items)
    .where(eq(items.sectionId, sectionId));
  return row?.n ?? 0;
}

/** Adds a divider at the end of the box, named after its position, with the box's capacity. */
export async function appendSection(locationId: string): Promise<Section> {
  const [location] = await db
    .select({ capacity: locations.sectionCapacity })
    .from(locations)
    .where(eq(locations.id, locationId));
  const [last] = await db
    .select({ position: max(locationSections.position) })
    .from(locationSections)
    .where(eq(locationSections.locationId, locationId));
  const position = (last?.position ?? 0) + 1;
  const [created] = await db
    .insert(locationSections)
    .values({ locationId, position, name: String(position), capacity: location?.capacity ?? null })
    .returning(sectionColumns);
  return created;
}

/** The divider after `sectionId` (the first one, for null), created if there isn't one yet. */
export async function nextSection(locationId: string, sectionId: string | null): Promise<Section> {
  const [current] = sectionId
    ? await db
        .select({ position: locationSections.position })
        .from(locationSections)
        .where(eq(locationSections.id, sectionId))
    : [];
  const [next] = await db
    .select(sectionColumns)
    .from(locationSections)
    .where(
      and(
        eq(locationSections.locationId, locationId),
        current ? gt(locationSections.position, current.position) : undefined,
      ),
    )
    .orderBy(asc(locationSections.position))
    .limit(1);
  return next ?? appendSection(locationId);
}
