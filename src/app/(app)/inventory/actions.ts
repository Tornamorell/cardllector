"use server";

import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { catalogCards, collections, items, locations } from "@/db/schema";
import { addToCollection } from "@/lib/collections/entries";
import { CONDITIONS } from "@/lib/format";
import { itemFilters } from "@/lib/queries/items";
import { requireUser } from "@/lib/session";

// The inventory: copies the user owns (D23). Every action re-checks the session and
// ownership — server actions are reachable by direct POST, not only through the UI.

async function ownedItem(userId: string, itemId: string) {
  const [row] = await db
    .select()
    .from(items)
    .where(and(eq(items.id, itemId), eq(items.ownerId, userId)));
  if (!row) throw new Error("Carta no encontrada");
  return row;
}

async function ownedLocation(userId: string, locationId: string) {
  const [row] = await db
    .select({ id: locations.id, name: locations.name })
    .from(locations)
    .where(and(eq(locations.id, locationId), eq(locations.ownerId, userId)));
  return row ?? null;
}

async function ownedCollection(userId: string, collectionId: string) {
  const [row] = await db
    .select({ id: collections.id, name: collections.name })
    .from(collections)
    .where(and(eq(collections.id, collectionId), eq(collections.ownerId, userId)));
  return row ?? null;
}

// Every page is dynamic; this also drops the client router cache of the others.
const refresh = () => revalidatePath("/", "layout");

type Finish = "nonfoil" | "foil" | "etched";
type Condition = (typeof CONDITIONS)[number];

/** Same printing, finish, condition, language and location, ungraded: the stack a copy joins. */
function sameStack(
  ownerId: string,
  s: {
    catalogCardId: string | null;
    finish: Finish;
    condition: Condition;
    language: string;
    locationId: string | null;
  },
) {
  return and(
    eq(items.ownerId, ownerId),
    s.catalogCardId ? eq(items.catalogCardId, s.catalogCardId) : isNull(items.catalogCardId),
    eq(items.finish, s.finish),
    eq(items.condition, s.condition),
    eq(items.language, s.language),
    s.locationId ? eq(items.locationId, s.locationId) : isNull(items.locationId),
    isNull(items.gradingCompany),
  );
}

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
  catalogCardId: z.uuid(),
  quantity: z.number().int().min(1).max(999),
  source: z.enum(["manual", "scan"]).default("manual"),
  /** Optionally list the card in a collection too. */
  collectionId: z
    .uuid()
    .nullish()
    .transform((v) => v ?? null),
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
      collectionName: string | null;
    }
  // A remembered location/collection was deleted: the client should forget it.
  | { ok: false; error: "location_not_found" | "collection_not_found" };

/**
 * Adds copies of a printing to the inventory (merging into an identical stack) and, if asked,
 * lists the printing in a collection.
 */
export async function addItem(input: AddItemInput): Promise<AddItemResult> {
  const user = await requireUser();
  const data = addItemInput.parse(input);

  const location = data.locationId ? await ownedLocation(user.id, data.locationId) : null;
  if (data.locationId && !location) return { ok: false, error: "location_not_found" };
  const collection = data.collectionId ? await ownedCollection(user.id, data.collectionId) : null;
  if (data.collectionId && !collection) return { ok: false, error: "collection_not_found" };

  const [card] = await db
    .select({ name: catalogCards.name, setCode: catalogCards.setCode, number: catalogCards.collectorNumber })
    .from(catalogCards)
    .where(eq(catalogCards.id, data.catalogCardId));
  if (!card) throw new Error("Carta no encontrada en el catálogo");

  const [existing] = await db.select({ id: items.id }).from(items).where(sameStack(user.id, data)).limit(1);

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
    const [inserted] = await db
      .insert(items)
      .values({
        ownerId: user.id,
        catalogCardId: data.catalogCardId,
        quantity: data.quantity,
        finish: data.finish,
        condition: data.condition,
        language: data.language,
        locationId: data.locationId,
        source: data.source,
      })
      .returning({ id: items.id });
    quantity = data.quantity;
    itemId = inserted.id;
  }

  if (collection) await addToCollection(collection.id, [{ catalogCardId: data.catalogCardId, quantity: 1 }]);

  refresh();
  return {
    ok: true,
    itemId,
    name: card.name,
    setCode: card.setCode,
    number: card.number,
    quantity,
    merged: !!existing,
    locationName: location?.name ?? null,
    collectionName: collection?.name ?? null,
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
  await ownedItem(user.id, itemId);
  const data = updateItemInput.parse(input);
  if (data.locationId && !(await ownedLocation(user.id, data.locationId))) {
    throw new Error("Ubicación no encontrada");
  }
  await db.update(items).set(data).where(eq(items.id, itemId));
  refresh();
}

export async function changeQuantity(itemId: string, delta: 1 | -1) {
  const user = await requireUser();
  const item = await ownedItem(user.id, itemId);
  if (item.quantity + delta <= 0) {
    await db.delete(items).where(eq(items.id, itemId));
  } else {
    await db.update(items).set({ quantity: item.quantity + delta }).where(eq(items.id, itemId));
  }
  refresh();
}

/** Moves `count` copies out of a stack into a new, otherwise identical stack. */
export async function splitItem(itemId: string, count: number) {
  const user = await requireUser();
  const item = await ownedItem(user.id, itemId);
  const n = z.number().int().min(1).max(item.quantity - 1).parse(count);
  await db.transaction(async (tx) => {
    await tx.update(items).set({ quantity: item.quantity - n }).where(eq(items.id, itemId));
    await tx.insert(items).values({
      ownerId: item.ownerId,
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
  refresh();
}

export async function deleteItem(itemId: string) {
  const user = await requireUser();
  await ownedItem(user.id, itemId);
  await db.delete(items).where(eq(items.id, itemId));
  refresh();
}

/**
 * Moves `count` copies of a stack to another finish ("that one was a reverse holo"), merging
 * into an identical stack with that finish if there is one. Returns the stack now holding them.
 */
export async function changeFinish(itemId: string, count: number, finish: Finish): Promise<{ itemId: string }> {
  const user = await requireUser();
  const item = await ownedItem(user.id, itemId);
  const target = z.enum(["nonfoil", "foil", "etched"]).parse(finish);
  const n = z.number().int().min(1).max(item.quantity).parse(count);
  if (item.finish === target) return { itemId };

  const targetId = await db.transaction(async (tx) => {
    if (item.quantity === n) await tx.delete(items).where(eq(items.id, itemId));
    else await tx.update(items).set({ quantity: item.quantity - n }).where(eq(items.id, itemId));

    const [same] = await tx
      .select({ id: items.id })
      .from(items)
      .where(sameStack(user.id, { ...item, finish: target }))
      .limit(1);
    if (same) {
      await tx
        .update(items)
        .set({ quantity: sql`${items.quantity} + ${n}` })
        .where(eq(items.id, same.id));
      return same.id;
    }
    const [inserted] = await tx
      .insert(items)
      .values({
        ownerId: item.ownerId,
        catalogCardId: item.catalogCardId,
        quantity: n,
        finish: target,
        condition: item.condition,
        language: item.language,
        locationId: item.locationId,
        source: item.source,
      })
      .returning({ id: items.id });
    return inserted.id;
  });

  refresh();
  return { itemId: targetId };
}

const toCollectionInput = z.object({
  collectionId: z.uuid(),
  /** A location id, null for copies without location, or absent for any. */
  locationId: z.uuid().nullable().optional(),
  q: z.string().max(80).optional(),
  itemIds: z.array(z.uuid()).max(1000).optional(),
});

/**
 * Lists owned printings in a collection: specific stacks (itemIds), or everything matching an
 * inventory filter ("what I scanned into Caja 1"). Each printing wants as many copies as are
 * owned, so the collection starts complete for them.
 */
export async function addInventoryToCollection(input: z.input<typeof toCollectionInput>) {
  const user = await requireUser();
  const data = toCollectionInput.parse(input);
  const collection = await ownedCollection(user.id, data.collectionId);
  if (!collection) throw new Error("Colección no encontrada");

  const scope =
    data.locationId === undefined ? { ownerId: user.id } : { ownerId: user.id, locationId: data.locationId };
  const filters = [...itemFilters(scope, data.q), isNotNull(items.catalogCardId)];
  if (data.itemIds?.length) filters.push(inArray(items.id, data.itemIds));

  const rows = await db
    .select({ catalogCardId: items.catalogCardId, quantity: sql<number>`sum(${items.quantity})::int` })
    .from(items)
    .leftJoin(catalogCards, eq(catalogCards.id, items.catalogCardId))
    .where(and(...filters))
    .groupBy(items.catalogCardId);

  await addToCollection(
    collection.id,
    rows.map((r) => ({ catalogCardId: r.catalogCardId!, quantity: r.quantity })),
  );
  refresh();
  return { cards: rows.length, collectionName: collection.name };
}
