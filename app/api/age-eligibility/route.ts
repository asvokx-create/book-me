import { NextResponse } from "next/server";
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
  const response = NextResponse.json({ ok: true });
  response.cookies.set(AGE_ELIGIBILITY_COOKIE, createAgeEligibilityAttestation(), ageEligibilityCookieOptions);
  return response;
}
