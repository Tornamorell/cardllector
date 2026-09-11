/**
 * Creates the app's user. Sign-up is closed in the app itself; this script opens it
 * only for its own process.
 *
 *   npm run seed:user -- <email> <password> [name]
 */
export {};

process.env.ALLOW_SIGNUP = "true";

const [email, password, displayName = "Marc"] = process.argv.slice(2);
if (!email || !password) {
  console.error("Usage: npm run seed:user -- <email> <password> [name]");
  process.exit(1);
}

const { auth } = await import("../src/lib/auth");
const { pool } = await import("../src/db/client");

const { user } = await auth.api.signUpEmail({ body: { email, password, name: displayName } });
console.log(`Created user ${user.email} (${user.id})`);
await pool.end();
