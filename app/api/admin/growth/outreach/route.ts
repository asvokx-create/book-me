import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import { database } from "@/lib/database";
import { getGooglePlacesTextSearchUsage, reserveGooglePlacesTextSearchRequest } from "@/lib/google-places-usage";
import { enforceRateLimit } from "@/lib/request-security";

const statuses = new Set(["researching", "contact_ready", "contacted", "replied", "interested", "registered", "not_interested", "suppressed"]);
const suppressionReasons = new Set(["opt_out", "complaint", "hard_bounce", "invalid", "manual"]);

function text(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function email(value: unknown) { const result = text(value, 254).toLowerCase(); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result) ? result : ""; }
function emailHash(value: string) { return createHash("sha256").update(value.trim().toLowerCase()).digest("hex"); }
function website(value: unknown) { const raw = text(value, 500); if (!raw) return ""; try { const parsed = new URL(raw); return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : ""; } catch { return ""; } }

async function audit(actorUserId: string, action: string, targetId: string, details: Record<string, unknown>) {
  await database.query(`INSERT INTO admin_audit_log(actor_user_id,action,target_type,target_id,details) VALUES($1,$2,'provider_outreach',$3,$4::jsonb)`, [actorUserId, action, targetId, JSON.stringify(details)]);
}

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  const [prospects, suppressions, drafts, placesDiscoveryBudget] = await Promise.all([
    database.query(`SELECT prospect.id::text, prospect.business_name, prospect.website, prospect.public_email, prospect.public_phone, prospect.city, prospect.state, prospect.service_category, prospect.contact_source, prospect.research_notes, prospect.status, prospect.last_contacted_at, prospect.replied_at, prospect.created_at, prospect.updated_at, count(draft.id)::int AS draft_count, max(draft.created_at) AS latest_draft_at FROM provider_outreach_prospects prospect LEFT JOIN provider_outreach_drafts draft ON draft.prospect_id=prospect.id GROUP BY prospect.id ORDER BY CASE prospect.status WHEN 'interested' THEN 0 WHEN 'replied' THEN 1 WHEN 'contact_ready' THEN 2 WHEN 'researching' THEN 3 ELSE 4 END, prospect.updated_at DESC LIMIT 300`),
    database.query(`SELECT id::text, reason, note, created_at FROM provider_outreach_suppressions ORDER BY created_at DESC LIMIT 100`),
    database.query(`SELECT id::text, prospect_id::text, subject, body, status, approval_note, approved_at, created_at FROM provider_outreach_drafts ORDER BY created_at DESC LIMIT 300`),
    getGooglePlacesTextSearchUsage(),
  ]);
  return NextResponse.json({ prospects: prospects.rows, suppressions: suppressions.rows, drafts: drafts.rows, placesDiscoveryBudget });
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  if (!await enforceRateLimit({ request, userId: session.user.id, bucket: "admin-provider-outreach", limit: 40 })) return NextResponse.json({ error: "Too many outreach actions. Please try again shortly." }, { status: 429 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const action = text(body?.action, 40);

  if (action === "discover") {
    try {
      const city = text(body?.city, 100), state = text(body?.state, 2).toUpperCase(), category = text(body?.category, 100);
      if (!city || !/^[A-Z]{2}$/.test(state) || !category) return NextResponse.json({ error: "Enter a city, state, and service category to search." }, { status: 400 });
      const apiKey = process.env.GOOGLE_MAPS_PLACES_API_KEY;
      if (!apiKey) return NextResponse.json({ error: "Provider discovery needs its restricted Google Places API key added to the app's server environment before it can search." }, { status: 503 });
      const reservation = await reserveGooglePlacesTextSearchRequest();
      if (!reservation.allowed) return NextResponse.json({ error: "The monthly provider-discovery limit has been reached. Searches will be available again next month.", placesDiscoveryBudget: reservation.usage }, { status: 429 });

      let googleResponse: Response;
      try {
        googleResponse = await fetch("https://places.googleapis.com/v1/places:searchText", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.primaryType,places.googleMapsUri",
          },
          body: JSON.stringify({ textQuery: `${category} in ${city}, ${state}`, pageSize: 20, languageCode: "en" }),
          cache: "no-store",
        });
      } catch {
        return NextResponse.json({ error: "Provider discovery could not reach Google right now. Please try again later.", placesDiscoveryBudget: reservation.usage }, { status: 502 });
      }
      if (!googleResponse.ok) return NextResponse.json({ error: "Google Places did not accept this search. Confirm that the server key is restricted to Places API (New), then try again.", placesDiscoveryBudget: reservation.usage }, { status: 502 });
      const payload = await googleResponse.json().catch(() => null) as { places?: Array<{ id?: string; displayName?: { text?: string }; formattedAddress?: string; primaryType?: string; googleMapsUri?: string }> } | null;
      const results = (payload?.places ?? []).flatMap((place) => {
        const businessName = text(place.displayName?.text, 160);
        return businessName ? [{ id: text(place.id, 200), businessName, address: text(place.formattedAddress, 300), category: text(place.primaryType, 100), mapsUrl: website(place.googleMapsUri) }] : [];
      });
      await audit(session.user.id, "provider_outreach_places_search", `${city}-${state}-${category}`.slice(0, 80), { resultCount: results.length, month: reservation.usage.month, used: reservation.usage.used });
      return NextResponse.json({ results, placesDiscoveryBudget: reservation.usage });
    } catch (error) {
      console.error("Provider discovery failed", error);
      return NextResponse.json({ error: "Provider discovery is temporarily unavailable. Please try again later." }, { status: 500 });
    }
  }

  if (action === "create") {
    const businessName = text(body?.businessName, 160), city = text(body?.city, 100), state = text(body?.state, 2).toUpperCase(), category = text(body?.category, 100);
    const publicEmail = email(body?.publicEmail);
    if (!businessName || !city || !/^[A-Z]{2}$/.test(state) || !category) return NextResponse.json({ error: "Business name, city, state, and service category are required." }, { status: 400 });
    if (text(body?.publicEmail, 254) && !publicEmail) return NextResponse.json({ error: "Enter a valid public business email or leave it blank." }, { status: 400 });
    const duplicate = await database.query<{ id: string }>(`SELECT id::text FROM provider_outreach_prospects WHERE lower(btrim(business_name))=lower($1) AND lower(btrim(city))=lower($2) AND lower(btrim(state))=lower($3) LIMIT 1`, [businessName, city, state]);
    if (duplicate.rows[0]) return NextResponse.json({ error: "That business is already in the outreach list." }, { status: 409 });
    const suppressed = publicEmail ? await database.query(`SELECT 1 FROM provider_outreach_suppressions WHERE email_hash=$1 LIMIT 1`, [emailHash(publicEmail)]) : { rows: [] };
    const status = suppressed.rows[0] ? "suppressed" : "researching";
    const created = await database.query<{ id: string }>(`INSERT INTO provider_outreach_prospects(business_name,website,public_email,public_phone,city,state,service_category,contact_source,research_notes,status,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id::text`, [businessName, website(body?.website) || null, publicEmail || null, text(body?.publicPhone, 50) || null, city, state, category, text(body?.contactSource, 300), text(body?.researchNotes, 4000), status, session.user.id]);
    await audit(session.user.id, "provider_outreach_prospect_created", created.rows[0].id, { status, suppressed: Boolean(suppressed.rows[0]) });
    return NextResponse.json({ ok: true });
  }

  const prospectId = text(body?.prospectId, 80);
  if (!prospectId) return NextResponse.json({ error: "Choose an outreach prospect." }, { status: 400 });
  const prospectResult = await database.query<{ id: string; business_name: string; public_email: string | null; city: string; state: string; service_category: string; status: string }>(`SELECT id::text,business_name,public_email,city,state,service_category,status FROM provider_outreach_prospects WHERE id::text=$1 LIMIT 1`, [prospectId]);
  const prospect = prospectResult.rows[0];
  if (!prospect) return NextResponse.json({ error: "That outreach prospect was not found." }, { status: 404 });

  if (action === "status") {
    const status = text(body?.status, 40);
    if (!statuses.has(status)) return NextResponse.json({ error: "Choose a valid outreach status." }, { status: 400 });
    const note = text(body?.researchNotes, 4000);
    await database.query(`UPDATE provider_outreach_prospects SET status=$2,research_notes=CASE WHEN $3='' THEN research_notes ELSE $3 END,last_contacted_at=CASE WHEN $2='contacted' THEN now() ELSE last_contacted_at END,replied_at=CASE WHEN $2 IN ('replied','interested') THEN now() ELSE replied_at END WHERE id::text=$1`, [prospectId, status, note]);
    await audit(session.user.id, "provider_outreach_status_changed", prospectId, { status });
    return NextResponse.json({ ok: true });
  }

  if (action === "draft") {
    if (!prospect.public_email || prospect.status === "suppressed") return NextResponse.json({ error: "A non-suppressed public business email is required before making a draft." }, { status: 409 });
    const blocked = await database.query(`SELECT 1 FROM provider_outreach_suppressions WHERE email_hash=$1 LIMIT 1`, [emailHash(prospect.public_email)]);
    if (blocked.rows[0]) return NextResponse.json({ error: "This contact is on the permanent suppression list." }, { status: 409 });
    const subject = `An invitation for ${prospect.business_name} to join BubsBookings`;
    const bodyText = `Hello ${prospect.business_name} team,\n\nBubsBookings is inviting independent ${prospect.service_category} providers serving ${prospect.city}, ${prospect.state} to consider listing their services on our marketplace.\n\nIf you are interested, you can review the provider signup information at https://bubsbookings.com/providers/join.\n\nThis is a saved draft only. Before any commercial email is sent, an administrator must approve it and add BubsBookings' approved mailing address and a working opt-out link.\n\nThank you,\nBubsBookings`;
    const draft = await database.query<{ id: string }>(`INSERT INTO provider_outreach_drafts(prospect_id,subject,body) VALUES($1::uuid,$2,$3) RETURNING id::text`, [prospectId, subject, bodyText]);
    await audit(session.user.id, "provider_outreach_draft_created", draft.rows[0].id, { prospectId });
    return NextResponse.json({ ok: true });
  }

  if (action === "approve_draft") {
    const draftId = text(body?.draftId, 80), note = text(body?.approvalNote, 1000);
    if (!draftId || !note) return NextResponse.json({ error: "An approval note is required." }, { status: 400 });
    const approved = await database.query(`UPDATE provider_outreach_drafts SET status='approved',approval_note=$2,approved_by=$3,approved_at=now() WHERE id::text=$1 AND prospect_id::text=$4 AND status='draft' RETURNING id`, [draftId, note, session.user.id, prospectId]);
    if (!approved.rows[0]) return NextResponse.json({ error: "That draft is not available for approval." }, { status: 409 });
    await audit(session.user.id, "provider_outreach_draft_approved", draftId, { prospectId });
    return NextResponse.json({ ok: true });
  }

  if (action === "suppress") {
    if (!prospect.public_email) return NextResponse.json({ error: "This prospect has no email to suppress." }, { status: 400 });
    const reason = text(body?.reason, 40);
    if (!suppressionReasons.has(reason)) return NextResponse.json({ error: "Choose a valid suppression reason." }, { status: 400 });
    await database.query(`INSERT INTO provider_outreach_suppressions(email_hash,reason,note,created_by) VALUES($1,$2,$3,$4) ON CONFLICT(email_hash) DO NOTHING`, [emailHash(prospect.public_email), reason, text(body?.note, 1000), session.user.id]);
    await database.query(`UPDATE provider_outreach_prospects SET status='suppressed' WHERE id::text=$1`, [prospectId]);
    await audit(session.user.id, "provider_outreach_suppressed", prospectId, { reason });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unsupported outreach action." }, { status: 400 });
}
