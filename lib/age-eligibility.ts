import { createHmac, timingSafeEqual } from "node:crypto";

export const AGE_ELIGIBILITY_COOKIE = "bubsbookings_age_eligibility";
const ATTESTATION_VERSION = 1;
const ATTESTATION_TTL_SECONDS = 30 * 60;

type CalendarDate = { year: number; month: number; day: number };
type AgeEligibilityAttestation = {
  v: number;
  eligible: true;
  issuedAt: number;
  expiresAt: number;
};

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function getAttestationSecret() {
  const configuredSecret = process.env.BETTER_AUTH_SECRET?.trim();
  if (configuredSecret) return configuredSecret;
  if (process.env.NODE_ENV === "production") throw new Error("BETTER_AUTH_SECRET is required in production.");
  return "bookme-local-development-secret-change-before-deploy";
}

function getToday(now: Date): CalendarDate {
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1, day: now.getUTCDate() };
}

function parseDateOfBirth(value: string): CalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { year, month, day };
}

function isOnOrBefore(left: CalendarDate, right: CalendarDate) {
  if (left.year !== right.year) return left.year < right.year;
  if (left.month !== right.month) return left.month < right.month;
  return left.day <= right.day;
}

/** Uses calendar dates so eligibility changes on the eighteenth birthday, not at an arbitrary time of day. */
export function isAtLeastEighteen(dateOfBirth: string, now = new Date()) {
  const birthDate = parseDateOfBirth(dateOfBirth);
  if (!birthDate || !isOnOrBefore(birthDate, getToday(now))) return false;
  const today = getToday(now);
  return isOnOrBefore(birthDate, { year: today.year - 18, month: today.month, day: today.day });
}

export function createAgeEligibilityAttestation(now = new Date()) {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const payload: AgeEligibilityAttestation = {
    v: ATTESTATION_VERSION,
    eligible: true,
    issuedAt,
    expiresAt: issuedAt + ATTESTATION_TTL_SECONDS,
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = createHmac("sha256", getAttestationSecret()).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}

export function verifyAgeEligibilityAttestation(token: string | null | undefined, now = new Date()) {
  if (!token) return false;
  const [encodedPayload, providedSignature, ...extraParts] = token.split(".");
  if (!encodedPayload || !providedSignature || extraParts.length > 0) return false;
  const expectedSignature = createHmac("sha256", getAttestationSecret()).update(encodedPayload).digest("base64url");
  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return false;
  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as Partial<AgeEligibilityAttestation>;
    const currentTime = Math.floor(now.getTime() / 1000);
    const issuedAt = payload.issuedAt;
    const expiresAt = payload.expiresAt;
    return payload.v === ATTESTATION_VERSION
      && payload.eligible === true
      && typeof issuedAt === "number"
      && typeof expiresAt === "number"
      && Number.isInteger(issuedAt)
      && Number.isInteger(expiresAt)
      && expiresAt > currentTime
      && expiresAt <= issuedAt + ATTESTATION_TTL_SECONDS;
  } catch {
    return false;
  }
}

export function getAgeEligibilityAttestationFromCookie(cookieHeader: string | null | undefined) {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [name, ...valueParts] = part.trim().split("=");
    if (name === AGE_ELIGIBILITY_COOKIE) return valueParts.join("=") || null;
  }
  return null;
}

export function hasValidAgeEligibilityAttestation(cookieHeader: string | null | undefined) {
  return verifyAgeEligibilityAttestation(getAgeEligibilityAttestationFromCookie(cookieHeader));
}

export const ageEligibilityCookieOptions = {
  httpOnly: true,
  maxAge: ATTESTATION_TTL_SECONDS,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};
