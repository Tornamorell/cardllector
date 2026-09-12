"use server";

import { and, eq, gt, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db/client";
import { catalogCards, collectionCards, collections } from "@/db/schema";
import { addToCollection } from "@/lib/collections/entries";
import { requireUser } from "@/lib/session";

// Collections are lists of printings (owned or not) with the copies wanted (D23). Every action
// re-checks the session and ownership.

async function ownedCollection(userId: string, collectionId: string) {
  const [row] = await db
    .select({ id: collections.id, name: collections.name })
    .from(collections)
    .where(and(eq(collections.id, collectionId), eq(collections.ownerId, userId)));
  if (!row) throw new Error("Colección no encontrada");
  return row;
}

const refresh = () => revalidatePath("/", "layout");

const collectionFields = z.object({
  name: z.string().trim().min(1, "Ponle un nombre").max(80),
  description: z
    .string()
    .trim()
    .max(500)
    .transform((v) => v || null),
});

/**
 * Creates a collection, unless one with the same name was created seconds ago: that's a double
 * tap or a retried request, not a second list, so it returns the first one.
 */
async function insertCollection(ownerId: string, fields: z.output<typeof collectionFields>) {
  const [recent] = await db
    .select({ id: collections.id, name: collections.name })
    .from(collections)
    .where(
      and(
        eq(collections.ownerId, ownerId),
        sql`lower(${collections.name}) = lower(${fields.name})`,
        gt(collections.createdAt, sql`now() - interval '15 seconds'`),
      ),
    )
    .limit(1);
  if (recent) return recent;
  const [created] = await db
    .insert(collections)
    .values({ ...fields, ownerId })
    .returning({ id: collections.id, name: collections.name });
  refresh();
  return created;
}

export async function createCollection(formData: FormData) {
  const user = await requireUser();
  const fields = collectionFields.parse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
  });
  const created = await insertCollection(user.id, fields);
  redirect(`/collections/${created.id}`);
}

/** Creates a collection from a picker ("+ Nueva colección…") and returns it. */
export async function createCollectionNamed(name: string): Promise<{ id: string; name: string }> {
  const user = await requireUser();
  return insertCollection(user.id, collectionFields.parse({ name, description: "" }));
}

export async function updateCollection(collectionId: string, formData: FormData) {
  const user = await requireUser();
  await ownedCollection(user.id, collectionId);
  const fields = collectionFields.parse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
  });
  await db.update(collections).set(fields).where(eq(collections.id, collectionId));
  refresh();
}

/** Deletes the list. The copies in the inventory stay. */
export async function deleteCollection(collectionId: string) {
  const user = await requireUser();
  await ownedCollection(user.id, collectionId);
  await db.delete(collections).where(eq(collections.id, collectionId));
  refresh();
  redirect("/collections");
}

const wanted = z.number().int().min(1).max(999);

/** Lists a printing in a collection (owned or not). Already listed: keeps the larger quantity. */
export async function addCardToCollection(collectionId: string, catalogCardId: string, quantity = 1) {
  const user = await requireUser();
  const collection = await ownedCollection(user.id, collectionId);
  const cardId = z.uuid().parse(catalogCardId);
  const [card] = await db
    .select({ name: catalogCards.name })
    .from(catalogCards)
    .where(eq(catalogCards.id, cardId));
  if (!card) throw new Error("Carta no encontrada en el catálogo");
  await addToCollection(collection.id, [{ catalogCardId: cardId, quantity: wanted.parse(quantity) }]);
  refresh();
  return { name: card.name, collectionName: collection.name };
}

export async function setWanted(collectionId: string, catalogCardId: string, quantity: number) {
  const user = await requireUser();
  await ownedCollection(user.id, collectionId);
  await db
    .update(collectionCards)
    .set({ quantity: wanted.parse(quantity) })
    .where(
      and(
        eq(collectionCards.collectionId, collectionId),
        eq(collectionCards.catalogCardId, z.uuid().parse(catalogCardId)),
      ),
    );
  refresh();
}

/** Takes a printing off the list. Owned copies stay in the inventory. */
export async function removeCardFromCollection(collectionId: string, catalogCardId: string) {
  const user = await requireUser();
  await ownedCollection(user.id, collectionId);
  await db
    .delete(collectionCards)
    .where(
      and(
        eq(collectionCards.collectionId, collectionId),
        eq(collectionCards.catalogCardId, z.uuid().parse(catalogCardId)),
      ),
    );
  refresh();
}
