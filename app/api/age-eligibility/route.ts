import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import {
  AGE_ELIGIBILITY_COOKIE,
  ageEligibilityCookieOptions,
  createAgeEligibilityAttestation,
  isAtLeastEighteen,
} from "@/lib/age-eligibility";

const UNDERAGE_MESSAGE = "You must be at least 18 years old to use BubsBookings.";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { dateOfBirth?: unknown } | null;
  const dateOfBirth = typeof body?.dateOfBirth === "string" ? body.dateOfBirth : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
    return NextResponse.json({ error: "Enter your date of birth." }, { status: 400 });
  }
  if (!isAtLeastEighteen(dateOfBirth)) {
    const response = NextResponse.json({ error: UNDERAGE_MESSAGE }, { status: 403 });
    response.cookies.set(AGE_ELIGIBILITY_COOKIE, "", { ...ageEligibilityCookieOptions, maxAge: 0 });
    return response;
  }
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) {
    await database.query(
      `UPDATE "user" SET age_verified_at = now() WHERE id = $1 AND age_verified_at IS NULL`,
      [session.user.id],
    );
  }
  const response = NextResponse.json({ ok: true, ageVerified: Boolean(session) });
  response.cookies.set(AGE_ELIGIBILITY_COOKIE, createAgeEligibilityAttestation(), ageEligibilityCookieOptions);
  return response;
}
