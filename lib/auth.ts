import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins";
import { database } from "./database";

export const auth = betterAuth({
  appName: "BookMe",
  database,
  secret:
    process.env.BETTER_AUTH_SECRET ??
    "bookme-local-development-secret-change-before-deploy",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  emailAndPassword: {
    enabled: true,
  },
  databaseHooks: {
    session: {
      create: {
        async before(session) {
          const restriction = await database.query<{ blocked: boolean }>(
            `SELECT true AS blocked
             FROM account_restrictions
             WHERE user_id = $1
               AND status IN ('suspended', 'banned')
               AND (expires_at IS NULL OR expires_at > now())
             LIMIT 1`,
            [session.userId],
          );
          if (restriction.rows[0]?.blocked) return false;
        },
      },
    },
  },
  user: {
    additionalFields: {
      phone: {
        type: "string",
        required: true,
      },
      role: {
        type: ["customer", "provider"],
        required: true,
        defaultValue: "customer",
        input: false,
      },
    },
  },
  plugins: [twoFactor({ issuer: "BookMe" })],
});

export function isAuthConfigured() {
  return Boolean(process.env.DATABASE_URL && process.env.BETTER_AUTH_SECRET);
}
