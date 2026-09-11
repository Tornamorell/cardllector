"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db/client";
import { locations } from "@/db/schema";
import { requireUser } from "@/lib/session";

const locationName = z
  .string()
  .trim()
  .min(1, "Ponle un nombre")
  .max(60)
  .transform((v) => v.replace(/\s+/g, " "));

function isUniqueViolation(error: unknown): boolean {
  const code = (e: unknown) =>
    typeof e === "object" && e !== null && "code" in e ? (e as { code: unknown }).code : null;
  const cause = typeof error === "object" && error !== null ? (error as { cause?: unknown }).cause : null;
  return code(error) === "23505" || code(cause) === "23505";
}

async function findByName(ownerId: string, name: string) {
  const [row] = await db
    .select({ id: locations.id, name: locations.name })
    .from(locations)
    .where(and(eq(locations.ownerId, ownerId), sql`lower(${locations.name}) = lower(${name})`));
  return row ?? null;
}

function refresh() {
  revalidatePath("/locations");
  revalidatePath("/collections");
  revalidatePath("/");
}

/**
 * Creates a location, or returns the existing one with the same name (case-insensitive), so
 * typing "caja 1" again in a picker just selects "Caja 1".
 */
export async function createLocation(name: string): Promise<{ id: string; name: string }> {
  const user = await requireUser();
  const clean = locationName.parse(name);
  const existing = await findByName(user.id, clean);
  if (existing) return existing;
  try {
    const [created] = await db
      .insert(locations)
      .values({ ownerId: user.id, name: clean })
      .returning({ id: locations.id, name: locations.name });
    refresh();
    return created;
  } catch (error) {
    // Lost a race with another insert of the same name.
    const raced = isUniqueViolation(error) ? await findByName(user.id, clean) : null;
    if (raced) return raced;
    throw error;
  }
}

async function ownedLocation(userId: string, id: string) {
  const [row] = await db
    .select({ id: locations.id })
    .from(locations)
    .where(and(eq(locations.id, id), eq(locations.ownerId, userId)));
  if (!row) throw new Error("Ubicación no encontrada");
  return row;
}

export async function updateLocation(id: string, formData: FormData) {
  const user = await requireUser();
  await ownedLocation(user.id, id);
  const name = locationName.parse(formData.get("name"));
  const description = String(formData.get("description") ?? "").trim().slice(0, 500) || null;
  try {
    await db.update(locations).set({ name, description }).where(eq(locations.id, id));
  } catch (error) {
    if (isUniqueViolation(error)) throw new Error("Ya tienes una ubicación con ese nombre");
    throw error;
  }
  refresh();
  revalidatePath(`/locations/${id}`);
}

/** Deletes the location; its copies stay in their collections, without location. */
export async function deleteLocation(id: string) {
  const user = await requireUser();
  await ownedLocation(user.id, id);
  await db.delete(locations).where(eq(locations.id, id));
  refresh();
  redirect("/locations");
}
