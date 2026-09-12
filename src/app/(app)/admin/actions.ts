"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/db/client";
import { user } from "@/db/auth-schema";
import { auth } from "@/lib/auth";
import { ROLES, type Role } from "@/lib/roles";
import { requireAdmin } from "@/lib/session";

type Result = { error?: string };

const newUser = z.object({
  name: z.string().trim().min(1).max(60),
  email: z.email(),
  password: z.string().min(8).max(128),
  role: z.enum(ROLES),
});

/** An account for a colleague (D34): sign-up is closed, so only admins let people in. */
export async function createColleague(input: z.input<typeof newUser>): Promise<Result> {
  await requireAdmin();
  const parsed = newUser.safeParse({ ...input, email: input.email?.trim().toLowerCase() });
  if (!parsed.success) {
    return { error: "Revisa los datos: un nombre, un correo válido y una contraseña de 8 caracteres o más." };
  }
  const [taken] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(sql`lower(${user.email})`, parsed.data.email));
  if (taken) return { error: "Ya hay una cuenta con ese correo." };

  try {
    await auth.api.createUser({ body: parsed.data, headers: await headers() });
  } catch (error) {
    console.error("[admin] createUser", error);
    return { error: "No se ha podido crear la cuenta." };
  }
  revalidatePath("/admin");
  return {};
}

export async function changeRole(userId: string, role: Role): Promise<Result> {
  const me = await requireAdmin();
  const id = z.string().min(1).parse(userId);
  const newRole = z.enum(ROLES).parse(role);
  // Nobody can lock themselves (and maybe everyone) out of the admin pages.
  if (id === me.id) return { error: "No puedes cambiar tu propio rol." };
  await auth.api.setRole({ body: { userId: id, role: newRole }, headers: await headers() });
  revalidatePath("/admin");
  return {};
}

/** Deactivates an account (its sessions are closed and it can't sign in) or reactivates it. */
export async function setDeactivated(userId: string, deactivated: boolean): Promise<Result> {
  const me = await requireAdmin();
  const id = z.string().min(1).parse(userId);
  if (id === me.id) return { error: "No puedes desactivar tu propia cuenta." };
  const h = await headers();
  if (deactivated) {
    await auth.api.banUser({ body: { userId: id, banReason: "Desactivada por un administrador" }, headers: h });
  } else {
    await auth.api.unbanUser({ body: { userId: id }, headers: h });
  }
  revalidatePath("/admin");
  return {};
}
