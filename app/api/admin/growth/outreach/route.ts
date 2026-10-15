import { createHash } from "node:crypto";
import { resolve4 } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import { database } from "@/lib/database";
import { getGooglePlacesTextSearchUsage, reserveGooglePlacesTextSearchRequest } from "@/lib/google-places-usage";
import { findPublicBusinessEmail } from "@/lib/public-contact-discovery";
import { isOutreachEmailConfigured, outreachSender, renderOutreachEmail, sendOutreachEmail } from "@/lib/provider-outreach-email";
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

function text(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function email(value: unknown) { const result = text(value, 254).toLowerCase(); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result) ? result : ""; }
function emailHash(value: string) { return createHash("sha256").update(value.trim().toLowerCase()).digest("hex"); }
function website(value: unknown) { const raw = text(value, 500); if (!raw) return ""; try { const parsed = new URL(raw); return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : ""; } catch { return ""; } }
function friendlyDraft(prospect: { business_name: string; city: string; state: string; service_category: string }) {
  return {
    subject: `A quick note from Christian at BubsBookings`,
    body: `Hi ${prospect.business_name} team,\n\nI’m Christian, the founder of BubsBookings. I came across your business while looking for great ${prospect.service_category} providers around ${prospect.city}, ${prospect.state}.\n\nWe’re building a simple way for local customers to find and book independent service businesses. I’d love for you to take a look and see whether BubsBookings could be a good fit for your business:\nhttps://bubsbookings.com/providers/join\n\nIf you have any questions, just reply to this email—I’d be happy to help.\n\nThanks,\nChristian\nFounder, BubsBookings`,
  };
}

async function audit(actorUserId: string, action: string, targetId: string, details: Record<string, unknown>) {
  await database.query(`INSERT INTO admin_audit_log(actor_user_id,action,target_type,target_id,details) VALUES($1,$2,'provider_outreach',$3,$4::jsonb)`, [actorUserId, action, targetId, JSON.stringify(details)]);
}

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  const [prospects, suppressions, drafts, deliveries, placesDiscoveryBudget] = await Promise.all([
    database.query(`SELECT prospect.id::text, prospect.business_name, prospect.website, prospect.public_email, prospect.public_phone, prospect.public_address, prospect.city, prospect.state, prospect.service_category, prospect.contact_source, prospect.research_notes, prospect.status, prospect.last_contacted_at, prospect.replied_at, prospect.created_at, prospect.updated_at, count(draft.id)::int AS draft_count, max(draft.created_at) AS latest_draft_at FROM provider_outreach_prospects prospect LEFT JOIN provider_outreach_drafts draft ON draft.prospect_id=prospect.id GROUP BY prospect.id ORDER BY CASE prospect.status WHEN 'interested' THEN 0 WHEN 'replied' THEN 1 WHEN 'contact_ready' THEN 2 WHEN 'researching' THEN 3 ELSE 4 END, prospect.updated_at DESC LIMIT 300`),
    database.query(`SELECT id::text, reason, note, created_at FROM provider_outreach_suppressions ORDER BY created_at DESC LIMIT 100`),
    database.query(`SELECT id::text, prospect_id::text, subject, body, status, approval_note, approved_at, created_at FROM provider_outreach_drafts ORDER BY created_at DESC LIMIT 300`),
    database.query(`SELECT id::text,draft_id::text,prospect_id::text,status,sent_at,error_message FROM provider_outreach_deliveries ORDER BY created_at DESC LIMIT 300`),
    getGooglePlacesTextSearchUsage(),
  ]);
  return NextResponse.json({ prospects: prospects.rows, suppressions: suppressions.rows, drafts: drafts.rows, deliveries: deliveries.rows, placesDiscoveryBudget, outreachSender: outreachSender(), outreachDeliveryReady: isOutreachEmailConfigured() });
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
    // Drafting is an internal, reversible review step. It is useful even before
    // a public inbox has been found; delivery remains separately blocked until
    // a reviewed email address is present.
    if (prospect.status === "suppressed") return NextResponse.json({ error: "This contact is on the permanent suppression list." }, { status: 409 });
    if (prospect.public_email) {
      const blocked = await database.query(`SELECT 1 FROM provider_outreach_suppressions WHERE email_hash=$1 LIMIT 1`, [emailHash(prospect.public_email)]);
      if (blocked.rows[0]) return NextResponse.json({ error: "This contact is on the permanent suppression list." }, { status: 409 });
    }
    const draftCopy = friendlyDraft(prospect);
    const draft = await database.query<{ id: string }>(`INSERT INTO provider_outreach_drafts(prospect_id,subject,body) VALUES($1::uuid,$2,$3) RETURNING id::text`, [prospectId, draftCopy.subject, draftCopy.body]);
    await audit(session.user.id, "provider_outreach_draft_created", draft.rows[0].id, { prospectId });
    return NextResponse.json({ ok: true });
  }

  if (action === "update_draft") {
    const draftId = text(body?.draftId, 80);
    const subject = text(body?.subject, 220);
    const bodyText = text(body?.body, 5_000);
    if (!draftId || !subject || !bodyText) return NextResponse.json({ error: "A subject and message are required to save this draft." }, { status: 400 });
    const updated = await database.query(`UPDATE provider_outreach_drafts SET subject=$2,body=$3,updated_at=now() WHERE id::text=$1 AND prospect_id::text=$4 AND status='draft' RETURNING id`, [draftId, subject, bodyText, prospectId]);
    if (!updated.rows[0]) return NextResponse.json({ error: "Only an unapproved draft can be edited." }, { status: 409 });
    await audit(session.user.id, "provider_outreach_draft_updated", draftId, { prospectId });
    return NextResponse.json({ ok: true });
  }

  if (action === "approve_draft") {
    const draftId = text(body?.draftId, 80), note = text(body?.approvalNote, 1000);
    if (!draftId) return NextResponse.json({ error: "Choose a draft to approve." }, { status: 400 });
    const approved = await database.query(`UPDATE provider_outreach_drafts SET status='approved',approval_note=$2,approved_by=$3,approved_at=now() WHERE id::text=$1 AND prospect_id::text=$4 AND status='draft' RETURNING id`, [draftId, note, session.user.id, prospectId]);
    if (!approved.rows[0]) return NextResponse.json({ error: "That draft is not available for approval." }, { status: 409 });
    await audit(session.user.id, "provider_outreach_draft_approved", draftId, { prospectId });
    return NextResponse.json({ ok: true });
  }

  if (action === "send_draft") {
    const draftId = text(body?.draftId, 80);
    if (!draftId) return NextResponse.json({ error: "Choose an approved draft to send." }, { status: 400 });
    if (!prospect.public_email || prospect.status === "suppressed" || prospect.status === "registered") return NextResponse.json({ error: "This prospect cannot receive provider outreach." }, { status: 409 });
    if (!isOutreachEmailConfigured()) return NextResponse.json({ error: "Outreach sending needs a verified Resend sender, an approved mailing address, and a signing secret before it can send email." }, { status: 503 });
    if (!await enforceRateLimit({ request, userId: session.user.id, bucket: "admin-provider-outreach-send", limit: 20, windowSeconds: 3_600 })) return NextResponse.json({ error: "Too many outreach emails were requested. Please wait and try again." }, { status: 429 });
    const [blocked, draftResult] = await Promise.all([
      database.query(`SELECT 1 FROM provider_outreach_suppressions WHERE email_hash=$1 LIMIT 1`, [emailHash(prospect.public_email)]),
      database.query<{ id: string; subject: string; body: string }>(`SELECT id::text,subject,body FROM provider_outreach_drafts WHERE id::text=$1 AND prospect_id::text=$2 AND status='approved' LIMIT 1`, [draftId, prospectId]),
    ]);
    if (blocked.rows[0]) return NextResponse.json({ error: "This contact is on the permanent suppression list." }, { status: 409 });
    const draft = draftResult.rows[0];
    if (!draft) return NextResponse.json({ error: "Only an approved draft can be sent." }, { status: 409 });

    // The unique draft ID is the application-level idempotency key. A retry is
    // only permitted after a known failure; a sent or in-progress draft cannot
    // be sent again by a second click or concurrent request.
    const deliveryResult = await database.query<{ id: string; status: string }>(`INSERT INTO provider_outreach_deliveries(prospect_id,draft_id,recipient_email,sender_email,status,sent_by) VALUES($1::uuid,$2::uuid,$3,$4,'sending',$5) ON CONFLICT(draft_id) DO UPDATE SET status='sending',error_message='' WHERE provider_outreach_deliveries.status='failed' RETURNING id::text,status`, [prospectId, draft.id, prospect.public_email, outreachSender(), session.user.id]);
    const delivery = deliveryResult.rows[0];
    if (!delivery) return NextResponse.json({ error: "This approved draft has already been sent or is currently being delivered." }, { status: 409 });
    const rendered = renderOutreachEmail({ businessName: prospect.business_name, subject: draft.subject, body: draft.body, deliveryId: delivery.id, recipientEmail: prospect.public_email });
    const sent = await sendOutreachEmail({ to: prospect.public_email, subject: draft.subject, html: rendered.html, unsubscribeUrl: rendered.unsubscribeUrl, idempotencyKey: `provider-outreach-${draft.id}` });
    if (!sent.sent) {
      await database.query(`UPDATE provider_outreach_deliveries SET status='failed',error_message=$2 WHERE id::text=$1`, [delivery.id, sent.error]);
      await audit(session.user.id, "provider_outreach_email_failed", delivery.id, { prospectId, draftId });
      return NextResponse.json({ error: sent.error }, { status: 502 });
    }
    await database.query(`UPDATE provider_outreach_deliveries SET status='sent',provider_message_id=$2,sent_at=now(),error_message='' WHERE id::text=$1`, [delivery.id, sent.messageId]);
    await database.query(`UPDATE provider_outreach_prospects SET status='contacted',last_contacted_at=now() WHERE id::text=$1 AND status NOT IN ('suppressed','registered')`, [prospectId]);
    await audit(session.user.id, "provider_outreach_email_sent", delivery.id, { prospectId, draftId, sender: outreachSender() });
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
    return NextResponse.json({ error: "The provider outreach action could not be completed right now. Please try again shortly." }, { status: 500 });
  }
}
