import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins";
import { database } from "./database";
import { isEmailConfigured, sendAuthEmail } from "./email";

const emailEnabled = isEmailConfigured();

export const auth = betterAuth({
  appName: "BubsBookings",
  database,
  secret:
    process.env.BETTER_AUTH_SECRET ??
    "bookme-local-development-secret-change-before-deploy",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: emailEnabled,
    sendResetPassword: async ({ user, url }) => {
      void sendAuthEmail({ to: user.email, name: user.name, url, kind: "reset" });
    },
    resetPasswordTokenExpiresIn: 3600,
    revokeSessionsOnPasswordReset: true,
  },
  emailVerification: {
    sendOnSignUp: emailEnabled,
    sendOnSignIn: emailEnabled,
    autoSignInAfterVerification: true,
    expiresIn: 3600,
    sendVerificationEmail: async ({ user, url }) => {
      void sendAuthEmail({ to: user.email, name: user.name, url, kind: "verify" });
    },
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
  plugins: [twoFactor({ issuer: "BubsBookings" })],
});

export function isAuthConfigured() {
  return Boolean(process.env.DATABASE_URL && process.env.BETTER_AUTH_SECRET);
}
