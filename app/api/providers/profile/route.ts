import { NextResponse } from "next/server";
import { database } from "@/lib/database";
import { checkAndRecordContent } from "@/lib/content-safety";
import { getProviderAccess } from "@/lib/provider-access";
import { PROVIDER_HIGHLIGHTS, PROVIDER_LANGUAGES, PROVIDER_PROFILE_LIMITS } from "@/lib/provider-profile-options";
import { recordActivity } from "@/lib/request-security";
import { runAutomatedProviderVerification } from "@/lib/provider-verification";

function stringArray(value: unknown, max: number, itemMax: number) {
  if (!Array.isArray(value)) return null;
  const items = [...new Set(value.map((item) => typeof item === "string" ? item.trim() : "").filter(Boolean))];
  return items.length <= max && items.every((item) => item.length <= itemMax) ? items : null;
}

async function ownerAccess() {
  const access = await getProviderAccess();
  return access?.isOwner ? access : null;
}

export async function GET() {
  const access = await ownerAccess();
  if (!access) return NextResponse.json({ error: "Only the business owner can edit the public profile." }, { status: 403 });
  const result = await database.query(
    `SELECT p.public_profile_slug, p.public_profile_visible, p.business_name, p.bio, p.years_experience,
            p.experience_summary, p.specialties, p.languages, p.provider_highlights, u.image AS profile_image_url
     FROM provider_profiles p JOIN "user" u ON u.id = p.user_id WHERE p.id::text = $1`,
    [access.providerId],
  );
  const portfolio = await database.query(
    `SELECT item.id::text, item.public_url AS url, item.caption, item.alt_text, item.service_id::text, item.sort_order,
            item.moderation_status, service.title AS service_title
     FROM provider_portfolio_items item LEFT JOIN services service ON service.id = item.service_id
     WHERE item.provider_id::text = $1 ORDER BY item.sort_order, item.created_at`, [access.providerId],
  );
  const services = await database.query(`SELECT id::text, title FROM services WHERE provider_id::text = $1 AND is_active = true ORDER BY title`, [access.providerId]);
  if (!result.rows[0]) return NextResponse.json({ error: "Provider profile not found." }, { status: 404 });
  const row = result.rows[0];
  return NextResponse.json({
    publicSlug: row.public_profile_slug, visible: row.public_profile_visible, businessName: row.business_name,
    about: row.bio, yearsExperience: row.years_experience, experienceSummary: row.experience_summary,
    specialties: row.specialties ?? [], languages: row.languages ?? [], highlights: row.provider_highlights ?? [],
    profileImageUrl: row.profile_image_url ?? "", portfolio: portfolio.rows, services: services.rows,
    options: { languages: PROVIDER_LANGUAGES, highlights: PROVIDER_HIGHLIGHTS },
  });
}

export async function PATCH(request: Request) {
  const access = await ownerAccess();
  if (!access) return NextResponse.json({ error: "Only the business owner can edit the public profile." }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid profile update." }, { status: 400 });
  const about = typeof body.about === "string" ? body.about.trim() : "";
  const experienceSummary = typeof body.experienceSummary === "string" ? body.experienceSummary.trim() : "";
  const yearsExperience = body.yearsExperience === null || body.yearsExperience === "" ? null : Number(body.yearsExperience);
  const specialties = stringArray(body.specialties, PROVIDER_PROFILE_LIMITS.specialties, PROVIDER_PROFILE_LIMITS.specialty);
  const languages = stringArray(body.languages, PROVIDER_PROFILE_LIMITS.languages, 50);
  const highlights = stringArray(body.highlights, PROVIDER_PROFILE_LIMITS.highlights, 60);
  if (about.length > PROVIDER_PROFILE_LIMITS.about || experienceSummary.length > PROVIDER_PROFILE_LIMITS.experience || specialties === null || languages === null || highlights === null || (yearsExperience !== null && (!Number.isInteger(yearsExperience) || yearsExperience < 0 || yearsExperience > 80))) return NextResponse.json({ error: "Review the profile field limits and try again." }, { status: 400 });
  if (languages.some((item) => !PROVIDER_LANGUAGES.includes(item as typeof PROVIDER_LANGUAGES[number])) || highlights.some((item) => !PROVIDER_HIGHLIGHTS.includes(item as typeof PROVIDER_HIGHLIGHTS[number]))) return NextResponse.json({ error: "Choose languages and highlights from the available options." }, { status: 400 });
  const safety = await checkAndRecordContent({ userId: access.session.user.id, surface: "provider_profile", fields: [about, experienceSummary, ...specialties] });
  if (!safety.allowed) return NextResponse.json({ error: safety.message }, { status: 422 });
  await database.query(
    `UPDATE provider_profiles SET bio = $2, years_experience = $3, experience_summary = $4,
       specialties = $5::text[], languages = $6::text[], provider_highlights = $7::text[], public_profile_visible = $8, updated_at = now()
     WHERE id::text = $1`,
    [access.providerId, about, yearsExperience, experienceSummary, specialties, languages, highlights, body.visible !== false],
  );
  await recordActivity({ userId: access.session.user.id, action: "public_provider_profile_updated", targetType: "provider", targetId: access.providerId });
  await runAutomatedProviderVerification(access.providerId).catch((error) => console.error("Post-profile-update verification failed", error));
  return NextResponse.json({ ok: true });
}
