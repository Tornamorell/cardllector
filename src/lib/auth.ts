import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db/client";
import * as schema from "@/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    // Single-user app: sign-up is closed. `npm run seed:user` opens it for its own process.
    disableSignUp: process.env.ALLOW_SIGNUP !== "true",
  },
  plugins: [nextCookies()],
});
