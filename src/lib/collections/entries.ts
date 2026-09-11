import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { collectionCards } from "@/db/schema";

/**
 * Adds printings to a collection. For printings already listed, the larger wanted quantity
 * wins (adding from the inventory never lowers what the user asked for). Server-only.
 */
export async function addToCollection(
  collectionId: string,
  rows: Array<{ catalogCardId: string; quantity: number }>,
) {
  // One row per printing, or the upsert would hit the same row twice.
  const byCard = new Map<string, number>();
  for (const r of rows) byCard.set(r.catalogCardId, Math.max(byCard.get(r.catalogCardId) ?? 0, r.quantity));
  if (!byCard.size) return;

  await db
    .insert(collectionCards)
    .values(
      [...byCard].map(([catalogCardId, quantity]) => ({
        collectionId,
        catalogCardId,
        quantity: Math.min(999, Math.max(1, quantity)),
      })),
    )
    .onConflictDoUpdate({
      target: [collectionCards.collectionId, collectionCards.catalogCardId],
      set: { quantity: sql`greatest(${collectionCards.quantity}, excluded.quantity)` },
    });
}
