import { createHash } from "node:crypto";
import { resolve4 } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import { database } from "@/lib/database";
import { getGooglePlacesTextSearchUsage, reserveGooglePlacesTextSearchRequest } from "@/lib/google-places-usage";
import { findPublicBusinessEmail } from "@/lib/public-contact-discovery";
import { enforceRateLimit } from "@/lib/request-security";

export const runtime = "nodejs";

type GooglePlacesResponse = { status: number; body: string };

function deadline<T>(promise: Promise<T>, milliseconds: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(message)), milliseconds);
    void promise.then((result) => { clearTimeout(timeout); resolve(result); }, (error) => { clearTimeout(timeout); reject(error); });
  });
}

async function searchGooglePlaces(apiKey: string, query: string) {
  // Resolve an IPv4 address explicitly. This bypasses the platform's slower
  // generic DNS path and retains the Google host name for TLS and HTTP.
  const address = (await deadline(resolve4("places.googleapis.com"), 1_500, "Google Places address lookup timed out"))[0];
  if (!address) throw new Error("Google Places has no IPv4 address available");

  return new Promise<GooglePlacesResponse>((resolve, reject) => {
    // App Platform ends a slow incoming request before a long outbound fetch
    // completes. A direct IPv4 request avoids an unavailable IPv6 route and
    // has its own timeout well inside the platform's request window.
    const request = httpsRequest({
      hostname: address,
      servername: "places.googleapis.com",
      path: "/v1/places:searchText",
      method: "POST",
      family: 4,
      headers: {
        Host: "places.googleapis.com",
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(query),
        // The server-only key remains in the platform environment and is never
        // exposed to the browser.
        "X-Goog-Api-Key": apiKey,
        // Google Places does not provide email. Request only the public
        // address, phone, and website fields used by this reviewed workflow.
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.primaryType,places.googleMapsUri,places.nationalPhoneNumber,places.websiteUri",
      },
    }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk: string) => { body += chunk; });
      response.on("end", () => { clearTimeout(timeout); resolve({ status: response.statusCode ?? 502, body }); });
    });
    const timeout = setTimeout(() => request.destroy(new Error("Google Places request timed out")), 6_500);
    request.on("error", (error) => { clearTimeout(timeout); reject(error); });
    request.on("close", () => clearTimeout(timeout));
    request.end(query);
  });
}

const statuses = new Set(["researching", "contact_ready", "contacted", "replied", "interested", "registered", "not_interested", "suppressed"]);
const suppressionReasons = new Set(["opt_out", "complaint", "hard_bounce", "invalid", "manual"]);
// This records the approved future sender for reviewed outreach. It is not a
// delivery configuration: this CRM intentionally has no email-sending action.
const OUTREACH_SENDER_EMAIL = "christian@bubsbookings.com";

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
    database.query(`SELECT prospect.id::text, prospect.business_name, prospect.website, prospect.public_email, prospect.public_phone, prospect.public_address, prospect.city, prospect.state, prospect.service_category, prospect.contact_source, prospect.research_notes, prospect.status, prospect.last_contacted_at, prospect.replied_at, prospect.created_at, prospect.updated_at, count(draft.id)::int AS draft_count, max(draft.created_at) AS latest_draft_at FROM provider_outreach_prospects prospect LEFT JOIN provider_outreach_drafts draft ON draft.prospect_id=prospect.id GROUP BY prospect.id ORDER BY CASE prospect.status WHEN 'interested' THEN 0 WHEN 'replied' THEN 1 WHEN 'contact_ready' THEN 2 WHEN 'researching' THEN 3 ELSE 4 END, prospect.updated_at DESC LIMIT 300`),
    database.query(`SELECT id::text, reason, note, created_at FROM provider_outreach_suppressions ORDER BY created_at DESC LIMIT 100`),
    database.query(`SELECT id::text, prospect_id::text, subject, body, status, approval_note, approved_at, created_at FROM provider_outreach_drafts ORDER BY created_at DESC LIMIT 300`),
    getGooglePlacesTextSearchUsage(),
  ]);
  return NextResponse.json({ prospects: prospects.rows, suppressions: suppressions.rows, drafts: drafts.rows, placesDiscoveryBudget, outreachSender: OUTREACH_SENDER_EMAIL });
}

async function handlePost(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const action = text(body?.action, 40);

  if (action === "discover") {
    const city = text(body?.city, 100), state = text(body?.state, 2).toUpperCase(), category = text(body?.category, 100);
    if (!city || !/^[A-Z]{2}$/.test(state) || !category) return NextResponse.json({ error: "Enter a city, state, and service category to search." }, { status: 400 });
    const apiKey = process.env.GOOGLE_MAPS_PLACES_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Provider discovery needs its restricted Google Places API key added to the app's server environment before it can search." }, { status: 503 });
    // This route is limited to administrators and every search atomically
    // reserves one request in the shared 999-per-month Google budget below.
    // Do not put the generic short-window limiter ahead of that reservation:
    // an outage in the generic limiter must not turn this controlled workflow
    // into an opaque 500 response.
    let reservation: Awaited<ReturnType<typeof reserveGooglePlacesTextSearchRequest>>;
    try {
      reservation = await reserveGooglePlacesTextSearchRequest();
    } catch (error) {
      console.error("Provider discovery budget check failed", error);
      return NextResponse.json({ error: "Provider discovery could not check its monthly search budget. Please try again later." }, { status: 503 });
    }
    if (!reservation.allowed) return NextResponse.json({ error: "The monthly provider-discovery limit has been reached. Searches will be available again next month.", placesDiscoveryBudget: reservation.usage }, { status: 429 });

    let googleResponse: GooglePlacesResponse;
    try {
      googleResponse = await searchGooglePlaces(apiKey, JSON.stringify({ textQuery: `${category} in ${city}, ${state}`, pageSize: 20, languageCode: "en" }));
    } catch (error) {
      console.error("Provider discovery Google request failed", error);
      return NextResponse.json({ error: "Provider discovery could not reach Google quickly enough. Please try again shortly.", placesDiscoveryBudget: reservation.usage }, { status: 502 });
    }
    if (googleResponse.status < 200 || googleResponse.status >= 300) return NextResponse.json({ error: "Google Places did not accept this search. Confirm that the server key is restricted to Places API (New), then try again.", placesDiscoveryBudget: reservation.usage }, { status: 502 });
    const payload = (() => { try { return JSON.parse(googleResponse.body) as { places?: Array<{ id?: string; displayName?: { text?: string }; formattedAddress?: string; primaryType?: string; googleMapsUri?: string; nationalPhoneNumber?: string; websiteUri?: string }> }; } catch { return null; } })();
    const results = (payload?.places ?? []).flatMap((place) => {
      const businessName = text(place.displayName?.text, 160);
      return businessName ? [{ id: text(place.id, 200), businessName, address: text(place.formattedAddress, 300), publicPhone: text(place.nationalPhoneNumber, 50), website: website(place.websiteUri), category: text(place.primaryType, 100), mapsUrl: website(place.googleMapsUri) }] : [];
    });
    try {
      await audit(session.user.id, "provider_outreach_places_search", `${city}-${state}-${category}`.slice(0, 80), { resultCount: results.length, month: reservation.usage.month, used: reservation.usage.used });
    } catch (error) {
      // Audit availability must never prevent an administrator from reviewing
      // results that were already returned by Google and counted in the budget.
      console.error("Provider discovery audit logging failed", error);
    }
    return NextResponse.json({ results, placesDiscoveryBudget: reservation.usage });
  }

  if (action === "find_public_email") {
    // This is intentionally separate from Google Places discovery. It only
    // reads the business website supplied by the reviewed result, and is
    // limited so an administrator cannot turn it into a website crawler.
    if (!await enforceRateLimit({ request, userId: session.user.id, bucket: "admin-outreach-public-email", limit: 12, windowSeconds: 3_600 })) {
      return NextResponse.json({ error: "Too many public-contact lookups. Please wait an hour and try again." }, { status: 429 });
    }
    const businessName = text(body?.businessName, 160);
    const businessWebsite = website(body?.website);
    if (!businessWebsite) return NextResponse.json({ error: "This business does not have a public website to review for contact details." }, { status: 400 });
    try {
      const match = await findPublicBusinessEmail(businessWebsite);
      await audit(session.user.id, "provider_outreach_public_email_checked", text(body?.resultId, 200) || businessName || businessWebsite, {
        businessName: businessName || undefined,
        found: Boolean(match),
        checkedPageCount: match?.checkedUrls.length ?? 0,
      });
      if (!match) return NextResponse.json({ publicEmail: "", emailSource: "", message: "No public business email was found on the contact pages checked. Use the business contact form or phone number instead." });
      return NextResponse.json({ publicEmail: match.email, emailSource: match.sourceUrl, message: "A public email was found. Review its source before saving this prospect." });
    } catch (error) {
      console.error("Public business email lookup failed", error);
      return NextResponse.json({ error: "The public business website could not be reviewed right now. You can still use its contact page or phone number." }, { status: 502 });
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
    const created = await database.query<{ id: string }>(`INSERT INTO provider_outreach_prospects(business_name,website,public_email,public_phone,public_address,city,state,service_category,contact_source,research_notes,status,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id::text`, [businessName, website(body?.website) || null, publicEmail || null, text(body?.publicPhone, 50) || null, text(body?.publicAddress, 300) || null, city, state, category, text(body?.contactSource, 300), text(body?.researchNotes, 4000), status, session.user.id]);
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

export async function POST(request: Request) {
  try {
    return await handlePost(request);
  } catch (error) {
    // Keep implementation details out of the browser while retaining the
    // complete error in the protected application log for diagnosis.
    console.error("Provider outreach request failed", error);
    return NextResponse.json({ error: "Provider discovery could not be completed right now. Please try again shortly." }, { status: 500 });
  }
}
