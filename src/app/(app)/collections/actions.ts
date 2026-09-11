"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db/client";
import { catalogCards, collections, items, locations } from "@/db/schema";
import { CONDITIONS } from "@/lib/format";
import { requireUser } from "@/lib/session";

// Every action re-checks the session and ownership: server actions are reachable by
// direct POST, not only through the UI.

async function ownedCollection(userId: string, collectionId: string) {
  const [row] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(and(eq(collections.id, collectionId), eq(collections.ownerId, userId)));
  if (!row) throw new Error("Colección no encontrada");
  return row;
}

/** The location if it exists and belongs to the user, else null. */
async function ownedLocation(userId: string, locationId: string) {
  const [row] = await db
    .select({ id: locations.id, name: locations.name })
    .from(locations)
    .where(and(eq(locations.id, locationId), eq(locations.ownerId, userId)));
  return row ?? null;
}

async function ownedItem(userId: string, itemId: string) {
  const [row] = await db
    .select({ item: items })
    .from(items)
    .innerJoin(collections, eq(collections.id, items.collectionId))
    .where(and(eq(items.id, itemId), eq(collections.ownerId, userId)));
  if (!row) throw new Error("Carta no encontrada");
  return row.item;
}

function refresh(collectionId: string) {
  revalidatePath(`/collections/${collectionId}`);
  revalidatePath("/collections");
  revalidatePath("/locations");
  revalidatePath("/");
}

// --- Collections ------------------------------------------------------------

const collectionFields = z.object({
  name: z.string().trim().min(1, "Ponle un nombre").max(80),
  description: z
    .string()
    .trim()
    .max(500)
    .transform((v) => v || null),
});

export async function createCollection(formData: FormData) {
  const user = await requireUser();
  const fields = collectionFields.parse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
  });
  const [created] = await db
    .insert(collections)
    .values({ ...fields, ownerId: user.id })
    .returning({ id: collections.id });
  revalidatePath("/collections");
  redirect(`/collections/${created.id}`);
}

export async function updateCollection(collectionId: string, formData: FormData) {
  const user = await requireUser();
  await ownedCollection(user.id, collectionId);
  const fields = collectionFields.parse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
  });
  await db.update(collections).set(fields).where(eq(collections.id, collectionId));
  refresh(collectionId);
}

export async function deleteCollection(collectionId: string) {
  const user = await requireUser();
  await ownedCollection(user.id, collectionId);
  await db.delete(collections).where(eq(collections.id, collectionId));
  revalidatePath("/collections");
  revalidatePath("/locations");
  revalidatePath("/");
  redirect("/collections");
}

// --- Items ------------------------------------------------------------------

const stackFields = z.object({
  finish: z.enum(["nonfoil", "foil", "etched"]),
  condition: z.enum(CONDITIONS),
  language: z.string().min(2).max(3),
  locationId: z
    .uuid()
    .nullish()
    .transform((v) => v ?? null),
});

const addItemInput = stackFields.extend({
  collectionId: z.uuid(),
  catalogCardId: z.uuid(),
  quantity: z.number().int().min(1).max(999),
  source: z.enum(["manual", "scan"]).default("manual"),
});

export type AddItemInput = z.input<typeof addItemInput>;

export type AddItemResult =
  | {
      ok: true;
      /** The stack the copies went into (new or existing): lets the scanner undo with -1. */
      itemId: string;
      name: string;
      setCode: string;
      number: string;
      quantity: number;
      merged: boolean;
      locationName: string | null;
    }
  // The remembered location was deleted (or never existed): the client should forget it.
  | { ok: false; error: "location_not_found" };

/**
 * Adds copies of a printing to a collection and location. If an identical stack exists
 * (same printing, finish, condition, language and location, ungraded), its quantity goes up.
 */
export async function addItem(input: AddItemInput): Promise<AddItemResult> {
  const user = await requireUser();
  const data = addItemInput.parse(input);
  await ownedCollection(user.id, data.collectionId);

  const location = data.locationId ? await ownedLocation(user.id, data.locationId) : null;
  if (data.locationId && !location) return { ok: false, error: "location_not_found" };

  const [card] = await db
    .select({ name: catalogCards.name, setCode: catalogCards.setCode, number: catalogCards.collectorNumber })
    .from(catalogCards)
    .where(eq(catalogCards.id, data.catalogCardId));
  if (!card) throw new Error("Carta no encontrada en el catálogo");

  const [existing] = await db
    .select({ id: items.id })
    .from(items)
    .where(
      and(
        eq(items.collectionId, data.collectionId),
        eq(items.catalogCardId, data.catalogCardId),
        eq(items.finish, data.finish),
        eq(items.condition, data.condition),
        eq(items.language, data.language),
        data.locationId ? eq(items.locationId, data.locationId) : isNull(items.locationId),
        isNull(items.gradingCompany),
      ),
    )
    .limit(1);

  let quantity: number;
  let itemId: string;
  if (existing) {
    const [updated] = await db
      .update(items)
      .set({ quantity: sql`${items.quantity} + ${data.quantity}` })
      .where(eq(items.id, existing.id))
      .returning({ quantity: items.quantity });
    quantity = updated.quantity;
    itemId = existing.id;
  } else {
    const [inserted] = await db.insert(items).values(data).returning({ id: items.id });
    quantity = data.quantity;
    itemId = inserted.id;
  }

  refresh(data.collectionId);
  return {
    ok: true,
    itemId,
    name: card.name,
    setCode: card.setCode,
    number: card.number,
    quantity,
    merged: !!existing,
    locationName: location?.name ?? null,
  };
}

const updateItemInput = stackFields.extend({
  quantity: z.number().int().min(1).max(999),
  purchasePriceEur: z.number().min(0).max(1_000_000).nullable(),
  notes: z
    .string()
    .trim()
    .max(500)
    .nullish()
    .transform((v) => v || null),
});

export type UpdateItemInput = z.input<typeof updateItemInput>;

export async function updateItem(itemId: string, input: UpdateItemInput) {
  const user = await requireUser();
  const item = await ownedItem(user.id, itemId);
  const data = updateItemInput.parse(input);
  if (data.locationId && !(await ownedLocation(user.id, data.locationId))) {
    throw new Error("Ubicación no encontrada");
  }
  await db.update(items).set(data).where(eq(items.id, itemId));
  refresh(item.collectionId);
}

export async function changeQuantity(itemId: string, delta: 1 | -1) {
  const user = await requireUser();
  const item = await ownedItem(user.id, itemId);
  if (item.quantity + delta <= 0) {
    await db.delete(items).where(eq(items.id, itemId));
  } else {
    await db.update(items).set({ quantity: item.quantity + delta }).where(eq(items.id, itemId));
  }
  refresh(item.collectionId);
}

/** Moves `count` copies out of a stack into a new, otherwise identical stack. */
export async function splitItem(itemId: string, count: number) {
  const user = await requireUser();
  const item = await ownedItem(user.id, itemId);
  const n = z.number().int().min(1).max(item.quantity - 1).parse(count);
  await db.transaction(async (tx) => {
    await tx.update(items).set({ quantity: item.quantity - n }).where(eq(items.id, itemId));
    await tx.insert(items).values({
      collectionId: item.collectionId,
      catalogCardId: item.catalogCardId,
      quantity: n,
      finish: item.finish,
      condition: item.condition,
      language: item.language,
      locationId: item.locationId,
      gradingCompany: item.gradingCompany,
      grade: item.grade,
      purchasePriceEur: item.purchasePriceEur,
      purchasedAt: item.purchasedAt,
      notes: item.notes,
      attributes: item.attributes,
      source: item.source,
    });
  });
  refresh(item.collectionId);
}

export async function deleteItem(itemId: string) {
  const user = await requireUser();
  const item = await ownedItem(user.id, itemId);
  await db.delete(items).where(eq(items.id, itemId));
  refresh(item.collectionId);
}
