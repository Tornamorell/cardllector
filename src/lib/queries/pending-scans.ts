import { and, asc, count, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { collections, locations, pendingScans } from "@/db/schema";

export async function pendingScanCount(ownerId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(pendingScans)
    .where(eq(pendingScans.ownerId, ownerId));
  return row?.n ?? 0;
}

/** The review queue, oldest first. Without the photos: /api/pending-scans/[id] serves them. */
export async function listPendingScans(ownerId: string) {
  return db
    .select({
      id: pendingScans.id,
      readText: pendingScans.readText,
      guess: pendingScans.guess,
      finish: pendingScans.finish,
      condition: pendingScans.condition,
      language: pendingScans.language,
      createdAt: pendingScans.createdAt,
      location: { id: locations.id, name: locations.name },
      collection: { id: collections.id, name: collections.name },
    })
    .from(pendingScans)
    .leftJoin(locations, eq(locations.id, pendingScans.locationId))
    .leftJoin(collections, eq(collections.id, pendingScans.collectionId))
    .where(eq(pendingScans.ownerId, ownerId))
    .orderBy(asc(pendingScans.createdAt));
}

export type PendingScan = Awaited<ReturnType<typeof listPendingScans>>[number];

export async function pendingScanImage(ownerId: string, id: string) {
  const [row] = await db
    .select({ image: pendingScans.image })
    .from(pendingScans)
    .where(and(eq(pendingScans.id, id), eq(pendingScans.ownerId, ownerId)));
  return row?.image ?? null;
}
