import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { catalogCards, items, locations } from "@/db/schema";
import { itemValueEurSql } from "@/lib/collection/pricing";

/** The most valuable stacks in the user's inventory, by per-copy value (estimate or market). */
export async function topStacks(ownerId: string, limit = 10) {
  return db
    .select({
      id: items.id,
      quantity: items.quantity,
      finish: items.finish,
      gradingCompany: items.gradingCompany,
      grade: items.grade,
      unitPriceEur: sql<number>`${itemValueEurSql}::float8`,
      location: { id: locations.id, name: locations.name },
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
    .innerJoin(catalogCards, eq(catalogCards.id, items.catalogCardId))
    .leftJoin(locations, eq(locations.id, items.locationId))
    .where(and(eq(items.ownerId, ownerId), isNotNull(itemValueEurSql)))
    .orderBy(sql`${itemValueEurSql} desc`)
    .limit(limit);
}
