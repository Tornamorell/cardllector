import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { catalogCards, collections, items } from "@/db/schema";
import { unitPriceEurSql } from "@/lib/collection/pricing";

/** The most valuable stacks across all the user's collections. */
export async function topStacks(ownerId: string, limit = 10) {
  return db
    .select({
      id: items.id,
      quantity: items.quantity,
      finish: items.finish,
      unitPriceEur: sql<number>`${unitPriceEurSql}::float8`,
      collectionId: collections.id,
      collectionName: collections.name,
      card: {
        id: catalogCards.id,
        game: catalogCards.game,
        name: catalogCards.name,
        setCode: catalogCards.setCode,
        collectorNumber: catalogCards.collectorNumber,
        imageSmall: catalogCards.imageSmall,
      },
    })
    .from(items)
    .innerJoin(collections, eq(collections.id, items.collectionId))
    .innerJoin(catalogCards, eq(catalogCards.id, items.catalogCardId))
    .where(and(eq(collections.ownerId, ownerId), isNotNull(unitPriceEurSql)))
    .orderBy(sql`${unitPriceEurSql} desc`)
    .limit(limit);
}
