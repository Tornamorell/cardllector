import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { db } from "@/db/client";
import * as schema from "@/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    // Sign-up is closed: admins create accounts in /admin (D34). `npm run seed:user` opens it
    // for its own process.
    disableSignUp: process.env.ALLOW_SIGNUP !== "true",
  },
  // Roles (D34): "admin" manages accounts and shared photos; everyone else is "user".
  // nextCookies() must stay last.
  plugins: [admin({ defaultRole: "user", adminRoles: ["admin"] }), nextCookies()],
});
