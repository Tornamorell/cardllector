"use server";

import { and, eq, like, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { catalogCardPhotos, catalogCards } from "@/db/schema";
import { CARD_PHOTO_PREFIX, cardPhotoUrl, isCardPhoto } from "@/lib/card-photo";
import { photoHash } from "@/lib/scan/photo-hash";
import { isAdmin, requireUser } from "@/lib/session";

/** A 300×419 JPEG weighs ~30 KB; this leaves room without letting big files in. */
const MAX_IMAGE_BYTES = 250_000;

/**
 * Shares a photo of a card the catalog has no image for (D30): everyone sees it. Never over a
 * catalog image (Scryfall, TCGdex). With `onlyIfMissing` (the scanner) it doesn't replace a
 * photo someone already took; from the card page it does ("Cambiar foto").
 */
export async function saveCardPhoto(
  form: FormData,
): Promise<{ saved: boolean; url?: string; hash?: string | null }> {
  const user = await requireUser();
  const image = form.get("image");
  if (!(image instanceof File) || image.type !== "image/jpeg" || image.size > MAX_IMAGE_BYTES) {
    throw new Error("Foto no válida");
  }
  const catalogCardId = z.uuid().parse(form.get("catalogCardId"));
  const source = form.get("source") === "scan" ? "scan" : "upload";
  const onlyIfMissing = form.get("onlyIfMissing") === "1";

  const [card] = await db
    .select({ image: catalogCards.imageSmall })
    .from(catalogCards)
    .where(eq(catalogCards.id, catalogCardId));
  if (!card) throw new Error("Carta no encontrada");
  if (card.image && !isCardPhoto(card.image)) return { saved: false };
  if (onlyIfMissing && card.image) return { saved: false };

  const now = new Date();
  const bytes = Buffer.from(await image.arrayBuffer());
  // What the scanner recognises the card by (D33). Without it, /api/scan/hashes retries later.
  const hash = await photoHash(bytes).catch(() => null);
  await db
    .insert(catalogCardPhotos)
    .values({ catalogCardId, image: bytes, contributedBy: user.id, source, hash, updatedAt: now })
    .onConflictDoUpdate({
      target: catalogCardPhotos.catalogCardId,
      set: { image: sql`excluded.image`, contributedBy: user.id, source, hash, updatedAt: now },
    });
  const url = cardPhotoUrl(catalogCardId, now);
  await db
    .update(catalogCards)
    .set({ imageSmall: url, imageNormal: url })
    .where(eq(catalogCards.id, catalogCardId));
  revalidatePath("/", "layout");
  return { saved: true, url, hash };
}

/**
 * Deletes a shared photo, whoever took it: admins only (D30). The card goes back to having no
 * image until someone shares another.
 */
export async function deleteCardPhoto(catalogCardId: string): Promise<{ deleted: boolean }> {
  const user = await requireUser();
  if (!isAdmin(user)) return { deleted: false };
  const id = z.uuid().parse(catalogCardId);
  const deleted = await db
    .delete(catalogCardPhotos)
    .where(eq(catalogCardPhotos.catalogCardId, id))
    .returning({ id: catalogCardPhotos.catalogCardId });
  if (!deleted.length) return { deleted: false };
  await db
    .update(catalogCards)
    .set({ imageSmall: null, imageNormal: null })
    .where(and(eq(catalogCards.id, id), like(catalogCards.imageSmall, `${CARD_PHOTO_PREFIX}%`)));
  revalidatePath("/", "layout");
  return { deleted: true };
}
