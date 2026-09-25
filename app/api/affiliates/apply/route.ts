import { NextResponse } from "next/server";
import { database } from "@/lib/database";
import { enforceRateLimit } from "@/lib/request-security";

function field(body: Record<string, unknown>, key: string, max = 500) {
  return typeof body[key] === "string" ? body[key].trim().slice(0, max) : "";
}
function optionalUrl(body: Record<string, unknown>, key: string) {
  const value = field(body, key, 500);
  if (!value) return null;
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? url.toString() : null; } catch { return null; }
}

export async function POST(request: Request) {
  const anonymousKey = request.headers.get("do-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0] ?? request.headers.get("user-agent") ?? "anonymous";
  if (!await enforceRateLimit({ request, userId: anonymousKey, bucket: "affiliate-application", limit: 5, windowSeconds: 3600 })) {
    return NextResponse.json({ error: "Too many applications. Please try again later." }, { status: 429 });
  }
  const body = (await request.json()) as Record<string, unknown>;
  const name = field(body, "name", 120);
  const email = field(body, "email", 254).toLowerCase();
  const audience = field(body, "primaryAudience", 500);
  const plan = field(body, "promotionPlan", 2000);
  if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || audience.length < 10 || plan.length < 30) {
    return NextResponse.json({ error: "Add your name, a valid email, audience details, and a clear promotion plan." }, { status: 400 });
  }
  const links = {
    website: optionalUrl(body, "website"), youtube: optionalUrl(body, "youtube"), instagram: optionalUrl(body, "instagram"),
    tiktok: optionalUrl(body, "tiktok"), other: optionalUrl(body, "otherSocial"),
  };
  if (Object.entries(links).some(([key, value]) => field(body, key === "other" ? "otherSocial" : key) && !value)) {
    return NextResponse.json({ error: "Social and website links must be valid http or https URLs." }, { status: 400 });
  }
  const inserted = await database.query<{ id: string }>(`INSERT INTO affiliate_profiles (program_id, display_name, email,
      website_url, youtube_url, instagram_url, tiktok_url, other_social_url, audience_size, primary_audience, promotion_plan, applicant_notes)
    SELECT program.id, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
    FROM affiliate_programs program WHERE program.status = 'enabled' ORDER BY program.created_at ASC LIMIT 1
    ON CONFLICT (lower(email)) DO NOTHING RETURNING id::text`, [name, email, links.website, links.youtube, links.instagram,
    links.tiktok, links.other, field(body, "audienceSize", 80), audience, plan, field(body, "notes", 2000)]);
  if (!inserted.rows[0]) return NextResponse.json({ error: "An application already exists for this email." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
