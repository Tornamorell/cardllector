import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "./auth";
import { isAdmin } from "./roles";

export { isAdmin } from "./roles";

/** Returns the signed-in user or redirects to /login. Use in every page and action. */
export async function requireUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  return session.user;
}

/** The signed-in admin; for anyone else the admin pages don't exist (D34). */
export async function requireAdmin() {
  const user = await requireUser();
  if (!isAdmin(user)) notFound();
  return user;
}
