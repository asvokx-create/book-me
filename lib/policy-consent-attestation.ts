import { createHmac, timingSafeEqual } from "node:crypto";
import { POLICY_VERSION } from "./policy-consent.ts";

export const POLICY_CONSENT_COOKIE = "bubsbookings_policy_consent";
const ATTESTATION_VERSION = 1;
const ATTESTATION_TTL_SECONDS = 30 * 60;

type PolicyConsentAttestation = {
  v: number;
  policyVersion: string;
  accepted: true;
  issuedAt: number;
  expiresAt: number;
};

function getSecret() {
  const configured = process.env.BETTER_AUTH_SECRET?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") throw new Error("BETTER_AUTH_SECRET is required in production.");
  return "bookme-local-development-secret-change-before-deploy";
}

function readCookie(cookieHeader: string | null | undefined) {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === POLICY_CONSENT_COOKIE) return value.join("=") || null;
  }
  return null;
}

export function createPolicyConsentAttestation(now = new Date()) {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const payload: PolicyConsentAttestation = {
    v: ATTESTATION_VERSION,
    policyVersion: POLICY_VERSION,
    accepted: true,
    issuedAt,
    expiresAt: issuedAt + ATTESTATION_TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", getSecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function hasValidPolicyConsentAttestation(cookieHeader: string | null | undefined, now = new Date()) {
  const token = readCookie(cookieHeader);
  if (!token) return false;
  const [encoded, signature, ...extra] = token.split(".");
  if (!encoded || !signature || extra.length) return false;
  const expected = Buffer.from(createHmac("sha256", getSecret()).update(encoded).digest("base64url"));
  const supplied = Buffer.from(signature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return false;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<PolicyConsentAttestation>;
    const time = Math.floor(now.getTime() / 1000);
    return payload.v === ATTESTATION_VERSION
      && payload.policyVersion === POLICY_VERSION
      && payload.accepted === true
      && Number.isInteger(payload.issuedAt)
      && Number.isInteger(payload.expiresAt)
      && Number(payload.expiresAt) > time
      && Number(payload.expiresAt) <= Number(payload.issuedAt) + ATTESTATION_TTL_SECONDS;
  } catch {
    return false;
  }
}

export const policyConsentCookieOptions = {
  httpOnly: true,
  maxAge: ATTESTATION_TTL_SECONDS,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};
