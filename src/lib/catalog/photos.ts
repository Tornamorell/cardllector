import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { catalogCardPhotos } from "@/db/schema";
import { CARD_PHOTO_PREFIX } from "@/lib/card-photo";

// Shared card photos (D30), server side.

export async function cardPhoto(catalogCardId: string) {
  const [row] = await db
    .select({ image: catalogCardPhotos.image })
    .from(catalogCardPhotos)
    .where(eq(catalogCardPhotos.catalogCardId, catalogCardId));
  return row?.image ?? null;
}

/**
 * Points cards without an image back at their shared photo. Syncs rewrite the image columns
 * from their source — null for cards it has no image for — so upsertCatalogCards runs this
 * after every batch. Same URL format as cardPhotoUrl().
 */
export async function restorePhotoUrls() {
  try {
    await db.execute(sql`
      update catalog_cards c
      set image_small = ${CARD_PHOTO_PREFIX} || c.id || '?v=' || floor(extract(epoch from p.updated_at))::bigint,
          image_normal = ${CARD_PHOTO_PREFIX} || c.id || '?v=' || floor(extract(epoch from p.updated_at))::bigint
      from catalog_card_photos p
      where p.catalog_card_id = c.id and c.image_small is null
    `);
  } catch (error) {
    // A sync that runs before the deploy that creates the table (migrations only run on
    // deploy, D13) has no photos to restore yet.
    if (!isMissingTable(error)) throw error;
  }
}

function isMissingTable(error: unknown): boolean {
  const code = (e: unknown) =>
    typeof e === "object" && e !== null && "code" in e ? (e as { code: unknown }).code : null;
  const cause = typeof error === "object" && error !== null ? (error as { cause?: unknown }).cause : null;
  return code(error) === "42P01" || code(cause) === "42P01";
}
