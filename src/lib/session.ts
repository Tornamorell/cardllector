import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";

/** Returns the signed-in user or redirects to /login. Use in every page and action. */
export async function requireUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  return session.user;
}

/** Admins are listed by email in ADMIN_EMAILS (comma-separated). They moderate shared photos (D30). */
export function isAdmin(user: { email: string }) {
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(user.email.toLowerCase());
}
