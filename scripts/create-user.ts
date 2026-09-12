/**
 * Creates an account from the command line: the owner's, the first one, an admin (D34).
 * Colleagues are created in /admin. Sign-up is closed in the app itself; this script opens it
 * only for its own process.
 *
 *   npm run seed:user -- <email> <password> [name] [role: admin | user]
 */
export {};

process.env.ALLOW_SIGNUP = "true";

const [email, password, displayName = "Marc", role = "admin"] = process.argv.slice(2);
if (!email || !password || !["admin", "user"].includes(role)) {
  console.error("Usage: npm run seed:user -- <email> <password> [name] [admin|user]");
  process.exit(1);
}

const { auth } = await import("../src/lib/auth");
const { db, pool } = await import("../src/db/client");
const { user: users } = await import("../src/db/auth-schema");
const { eq } = await import("drizzle-orm");

const { user } = await auth.api.signUpEmail({ body: { email, password, name: displayName } });
// Sign-up gives everyone the default role; the role isn't something a sign-up may choose.
await db.update(users).set({ role }).where(eq(users.id, user.id));
console.log(`Created ${role} ${user.email} (${user.id})`);
await pool.end();
