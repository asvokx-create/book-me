import { NextResponse } from "next/server";
import { database } from "@/lib/database";
import { enforceRateLimit } from "@/lib/request-security";
import { scanContent } from "@/lib/content-safety";
import { sendTransactionalEmail } from "@/lib/email";

const partnershipTypes = new Set(["Fixed campaign payment", "Revenue share", "Hybrid partnership", "Sponsored placement", "Newsletter promotion", "Website / blog promotion", "Social media promotion", "Other"]);
const platforms = new Set(["YouTube", "TikTok", "Instagram", "Facebook", "X", "Newsletter / Email", "Website / Blog", "Podcast", "Community", "Other"]);
const promotionTypes = new Set(["Newsletter placement", "Dedicated email", "Website banner", "Blog placement", "YouTube integration", "Dedicated video", "TikTok video", "Instagram Reel", "Instagram Story", "Social post", "Podcast mention", "Community promotion", "Other"]);

function field(body: Record<string, unknown>, key: string, max = 500) {
  return typeof body[key] === "string" ? body[key].trim().slice(0, max) : "";
}
function optionalUrl(body: Record<string, unknown>, key: string) {
  const value = field(body, key, 500);
  if (!value) return null;
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? url.toString() : null; } catch { return null; }
}
function selected(body: Record<string, unknown>, key: string, allowed: Set<string>) {
  if (!Array.isArray(body[key])) return [];
  return [...new Set(body[key].filter((value): value is string => typeof value === "string" && allowed.has(value)))];
}
function optionalCount(body: Record<string, unknown>, key: string) {
  if (body[key] === "" || body[key] == null) return null;
  const value = Number(body[key]);
  return Number.isInteger(value) && value >= 0 && value <= 2_000_000_000 ? value : Number.NaN;
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
  const notes = field(body, "notes", 2000);
  const customRequested = body.customPartnershipRequested === true;
  const requestedTypes = selected(body, "customPartnershipTypes", partnershipTypes);
  const activePlatforms = selected(body, "platforms", platforms);
  const requestedPromotions = selected(body, "promotionTypes", promotionTypes);
  const customNotes = field(body, "customPartnershipNotes", 1200);
  const otherAudienceSize = field(body, "otherAudienceSize", 120);
  if (body.partnerAgreementAccepted !== "true" && body.partnerAgreementAccepted !== true) {
    return NextResponse.json({ error: "Review and accept the Partner Agreement before applying." }, { status: 400 });
  }
  if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || audience.length < 10 || plan.length < 30) {
    return NextResponse.json({ error: "Add your name, a valid email, audience details, and a clear promotion plan." }, { status: 400 });
  }
  if (customRequested && (requestedTypes.length < 1 || (activePlatforms.length < 1 && requestedPromotions.length < 1))) {
    return NextResponse.json({ error: "For a custom request, choose a partnership type and at least one platform or promotion option." }, { status: 400 });
  }
  const counts = ["followerCount", "subscriberCount", "emailListSize", "monthlyTraffic", "averageContentViews"].map(key => optionalCount(body, key));
  if (counts.some(Number.isNaN)) return NextResponse.json({ error: "Audience counts must be whole numbers of zero or more." }, { status: 400 });
  const safety = scanContent([name, audience, plan, notes, customNotes, otherAudienceSize].join("\n"));
  if (!safety.allowed) return NextResponse.json({ error: safety.message }, { status: 422 });
  const links = {
    website: optionalUrl(body, "website"), youtube: optionalUrl(body, "youtube"), instagram: optionalUrl(body, "instagram"),
    tiktok: optionalUrl(body, "tiktok"), other: optionalUrl(body, "otherSocial"), mediaKit: optionalUrl(body, "mediaKitUrl"),
    portfolio: optionalUrl(body, "portfolioUrl"),
  };
  const linkKeys: Record<string, string> = { other: "otherSocial", mediaKit: "mediaKitUrl", portfolio: "portfolioUrl" };
  if (Object.entries(links).some(([key, value]) => field(body, linkKeys[key] ?? key) && !value)) {
    return NextResponse.json({ error: "Social and website links must be valid http or https URLs." }, { status: 400 });
  }
  const inserted = await database.query<{ id: string }>(`INSERT INTO affiliate_profiles (program_id, display_name, email,
      website_url, youtube_url, instagram_url, tiktok_url, other_social_url, audience_size, primary_audience, promotion_plan, applicant_notes,
      partner_agreement_accepted_at, partner_agreement_version, custom_partnership_requested, custom_partnership_types,
      active_platforms, promotion_types, follower_count, subscriber_count, email_list_size, monthly_website_traffic,
      average_content_views, other_audience_size, media_kit_url, custom_partnership_notes, portfolio_url)
    SELECT program.id, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now(), '2026-10-03', $12, $13, $14, $15,
      $16, $17, $18, $19, $20, $21, $22, $23, $24
    FROM affiliate_programs program WHERE program.status = 'enabled' ORDER BY program.created_at ASC LIMIT 1
    ON CONFLICT (lower(email)) DO NOTHING RETURNING id::text`, [name, email, links.website, links.youtube, links.instagram,
    links.tiktok, links.other, field(body, "audienceSize", 80), audience, plan, notes, customRequested, requestedTypes,
    activePlatforms, requestedPromotions, ...counts, otherAudienceSize, links.mediaKit, customNotes, links.portfolio]);
  if (!inserted.rows[0]) return NextResponse.json({ error: "An application already exists for this email." }, { status: 409 });
  const applicationId = inserted.rows[0].id;
  await Promise.allSettled([
    sendTransactionalEmail({
      to: email,
      subject: customRequested ? "We received your BubsBookings partnership request" : "We received your BubsBookings Partner application",
      heading: customRequested ? "Custom partnership request received" : "Partner application received",
      message: customRequested
        ? "Thanks for applying to partner with BubsBookings. We received your custom partnership request and will review the information you provided. This does not guarantee approval or specific compensation."
        : "Thanks for applying to the BubsBookings Partner Program. We will review your application. This does not guarantee approval.",
      emailType: `partner_application_${customRequested ? "custom" : "standard"}`,
      idempotencyKey: `partner-application-${applicationId}`,
      actionLabel: "View the Partner Program",
      actionUrl: "/partners",
    }),
    database.query(`INSERT INTO notifications (user_id,type,title,message,href,dedupe_key)
      SELECT admin.user_id,'partner_application',$1,$2,'/admin/affiliates',$3 || '-' || admin.user_id
      FROM (SELECT user_id FROM bookme_admins UNION SELECT id FROM "user" WHERE lower(email) IN ('asvokx@gmail.com','christian@bubsbookings.com')) admin
      ON CONFLICT (dedupe_key) DO NOTHING`, [customRequested ? "Custom Partnership Requested" : "New Partner Application",
      `${name} submitted ${customRequested ? "a custom partnership request" : "a standard Partner application"}.`, `partner-application-${applicationId}`]),
  ]);
  return NextResponse.json({ ok: true });
}
