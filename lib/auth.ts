import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins";
import { database } from "./database";
import { isEmailConfigured, sendAuthEmail } from "./email";
import { createPolicyConsentFields, POLICY_VERSION } from "./policy-consent";

const emailEnabled = isEmailConfigured();
const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const authBaseUrl = process.env.NODE_ENV === "production"
  ? "https://bubsbookings.com"
  : process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const trustedOrigins = Array.from(new Set([
  authBaseUrl,
  process.env.BETTER_AUTH_URL,
  process.env.NEXT_PUBLIC_APP_URL,
  "https://bubsbookings.com",
  "https://www.bubsbookings.com",
  ...(process.env.NODE_ENV === "production" ? [] : ["http://localhost:3000", "http://localhost:3001"]),
].filter((origin): origin is string => Boolean(origin))));

export const auth = betterAuth({
  appName: "BubsBookings",
  database,
  secret:
    process.env.BETTER_AUTH_SECRET ??
    "bookme-local-development-secret-change-before-deploy",
  baseURL: authBaseUrl,
  trustedOrigins,
  socialProviders: {
    ...(googleEnabled
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            disableImplicitSignUp: true,
            prompt: "select_account" as const,
            mapProfileToUser: () => ({ phone: "", ...createPolicyConsentFields() }),
          },
        }
      : {}),
  },
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
    user: {
      create: {
        async before(user) {
          const termsAcceptedAt = typeof user.termsAcceptedAt === "string" ? Date.parse(user.termsAcceptedAt) : Number.NaN;
          const privacyAcknowledgedAt = typeof user.privacyAcknowledgedAt === "string" ? Date.parse(user.privacyAcknowledgedAt) : Number.NaN;
          const aiSafetyAcknowledgedAt = typeof user.aiSafetyAcknowledgedAt === "string" ? Date.parse(user.aiSafetyAcknowledgedAt) : Number.NaN;
          if (
            user.policyVersion !== POLICY_VERSION ||
            !Number.isFinite(termsAcceptedAt) ||
            !Number.isFinite(privacyAcknowledgedAt) ||
            !Number.isFinite(aiSafetyAcknowledgedAt)
          ) return false;
        },
      },
    },
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
      termsAcceptedAt: {
        type: "string",
        required: true,
        returned: false,
        fieldName: "terms_accepted_at",
      },
      privacyAcknowledgedAt: {
        type: "string",
        required: true,
        returned: false,
        fieldName: "privacy_acknowledged_at",
      },
      aiSafetyAcknowledgedAt: {
        type: "string",
        required: true,
        returned: false,
        fieldName: "ai_safety_acknowledged_at",
      },
      policyVersion: {
        type: "string",
        required: true,
        returned: false,
        fieldName: "policy_version",
      },
    },
  },
  plugins: [twoFactor({ issuer: "BubsBookings" })],
});

export function isAuthConfigured() {
  return Boolean(process.env.DATABASE_URL && process.env.BETTER_AUTH_SECRET);
}

export function getSocialProviderAvailability() {
  return { google: googleEnabled };
}
