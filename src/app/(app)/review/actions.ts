"use server";

import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { collections, locations, pendingScans } from "@/db/schema";
import { CONDITIONS } from "@/lib/format";
import { ownedSection } from "@/lib/locations/sections";
import { requireUser } from "@/lib/session";
import { addItem, type AddItemResult } from "../inventory/actions";

// The scanner's review queue (D25). Every action re-checks the session and ownership.

/** A 560 px-tall JPEG weighs 50–100 KB; this leaves room without letting big files in. */
const MAX_IMAGE_BYTES = 400_000;
/** Keeps a runaway client from filling Neon's free 0.5 GB with photos. */
const MAX_PENDING = 500;

const stackSettings = {
  finish: z.enum(["nonfoil", "foil", "etched"]),
  condition: z.enum(CONDITIONS),
  language: z.string().min(2).max(3),
};

const saveInput = z.object({
  ...stackSettings,
  readText: z.string().max(2000).nullable(),
  guess: z.string().max(200).nullable(),
  locationId: z.uuid().nullable(),
  sectionId: z.uuid().nullable(),
  collectionId: z.uuid().nullable(),
});

/**
 * «Para luego» in the scanner: keeps a photo of a card it didn't recognise, with the session's
 * settings, to identify it by hand in /review. Returns how many are waiting.
 */
export async function savePendingScan(form: FormData): Promise<{ pending: number }> {
  const user = await requireUser();
  const image = form.get("image");
  if (!(image instanceof File) || image.type !== "image/jpeg" || image.size > MAX_IMAGE_BYTES) {
    throw new Error("Imagen no válida");
  }
  const field = (key: string) => {
    const v = form.get(key);
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };
  const data = saveInput.parse({
    finish: field("finish"),
    condition: field("condition"),
    language: field("language"),
    readText: field("readText"),
    guess: field("guess"),
    locationId: field("locationId"),
    sectionId: field("sectionId"),
    collectionId: field("collectionId"),
  });

  const [{ n }] = await db
    .select({ n: count() })
    .from(pendingScans)
    .where(eq(pendingScans.ownerId, user.id));
  if (n >= MAX_PENDING) throw new Error("Hay demasiadas cartas por revisar");

  // Keep the location and collection only if they're the user's.
  const [location] = data.locationId
    ? await db
        .select({ id: locations.id })
        .from(locations)
        .where(and(eq(locations.id, data.locationId), eq(locations.ownerId, user.id)))
    : [];
  const [collection] = data.collectionId
    ? await db
        .select({ id: collections.id })
        .from(collections)
        .where(and(eq(collections.id, data.collectionId), eq(collections.ownerId, user.id)))
    : [];

  const section =
    location && data.sectionId ? await ownedSection(user.id, data.sectionId, location.id) : null;

  await db.insert(pendingScans).values({
    ownerId: user.id,
    image: Buffer.from(await image.arrayBuffer()),
    readText: data.readText,
    guess: data.guess,
    finish: data.finish,
    condition: data.condition,
    language: data.language,
    locationId: location?.id ?? null,
    sectionId: section?.id ?? null,
    collectionId: collection?.id ?? null,
  });
  revalidatePath("/", "layout");
  return { pending: n + 1 };
}

const resolveInput = z.object({ ...stackSettings, catalogCardId: z.uuid() });

/** Adds the identified card with the settings saved in the queue, then removes it from the queue. */
export async function resolvePendingScan(
  id: string,
  input: z.input<typeof resolveInput>,
): Promise<AddItemResult> {
  const user = await requireUser();
  const scanId = z.uuid().parse(id);
  const data = resolveInput.parse(input);
  const [scan] = await db
    .select({
      locationId: pendingScans.locationId,
      sectionId: pendingScans.sectionId,
      collectionId: pendingScans.collectionId,
    })
    .from(pendingScans)
    .where(and(eq(pendingScans.id, scanId), eq(pendingScans.ownerId, user.id)));
  if (!scan) throw new Error("Carta por revisar no encontrada");

  const result = await addItem({
    ...data,
    quantity: 1,
    source: "scan",
    locationId: scan.locationId,
    sectionId: scan.sectionId,
    collectionId: scan.collectionId,
  });
  if (result.ok) {
    await db.delete(pendingScans).where(eq(pendingScans.id, scanId));
    revalidatePath("/", "layout");
  }
  return result;
}

export async function discardPendingScan(id: string) {
  const user = await requireUser();
  await db
    .delete(pendingScans)
    .where(and(eq(pendingScans.id, z.uuid().parse(id)), eq(pendingScans.ownerId, user.id)));
  revalidatePath("/", "layout");
}
