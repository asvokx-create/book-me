import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { database } from "@/lib/database";
import { checkAndRecordContent } from "@/lib/content-safety";
import { detectSupportedImageFormat } from "@/lib/image-format";
import { LISTING_IMAGE_MAX_BYTES, LISTING_IMAGE_MAX_MB } from "@/lib/listing-images";
import { getProviderAccess } from "@/lib/provider-access";
import { PROVIDER_PROFILE_LIMITS } from "@/lib/provider-profile-options";
import { enforceRateLimit, recordActivity } from "@/lib/request-security";
import { deleteImage, uploadPublicImage } from "@/lib/spaces";

export const runtime = "nodejs";

async function ownerAccess() { const access = await getProviderAccess(); return access?.isOwner ? access : null; }

export async function POST(request: Request) {
  const access = await ownerAccess();
  if (!access) return NextResponse.json({ error: "Only the business owner can manage the portfolio." }, { status: 403 });
  if (!await enforceRateLimit({ request, userId: access.session.user.id, bucket: "portfolio-upload", limit: 15, windowSeconds: 3600 })) return NextResponse.json({ error: "Too many portfolio uploads. Try again later." }, { status: 429 });
  const count = await database.query<{ count: string }>("SELECT count(*)::text FROM provider_portfolio_items WHERE provider_id::text = $1", [access.providerId]);
  if (Number(count.rows[0]?.count ?? 0) >= PROVIDER_PROFILE_LIMITS.portfolio) return NextResponse.json({ error: `A portfolio can include up to ${PROVIDER_PROFILE_LIMITS.portfolio} images.` }, { status: 400 });
  const form = await request.formData();
  const image = form.get("image");
  const caption = typeof form.get("caption") === "string" ? String(form.get("caption")).trim() : "";
  const altText = typeof form.get("altText") === "string" ? String(form.get("altText")).trim() : "";
  const serviceId = typeof form.get("serviceId") === "string" ? String(form.get("serviceId")).trim() || null : null;
  if (!(image instanceof File) || image.size === 0 || image.size > LISTING_IMAGE_MAX_BYTES) return NextResponse.json({ error: `Choose a JPG, PNG, or WebP under ${LISTING_IMAGE_MAX_MB} MB.` }, { status: 400 });
  if (caption.length > PROVIDER_PROFILE_LIMITS.caption || altText.length > PROVIDER_PROFILE_LIMITS.altText) return NextResponse.json({ error: "Caption and image description are too long." }, { status: 400 });
  const safety = await checkAndRecordContent({ userId: access.session.user.id, surface: "provider_portfolio", fields: [caption, altText] });
  if (!safety.allowed) return NextResponse.json({ error: safety.message }, { status: 422 });
  if (serviceId) {
    const service = await database.query("SELECT 1 FROM services WHERE id::text = $1 AND provider_id::text = $2 AND is_active = true", [serviceId, access.providerId]);
    if (!service.rows[0]) return NextResponse.json({ error: "Choose one of your active services." }, { status: 400 });
  }
  const bytes = Buffer.from(await image.arrayBuffer());
  const format = detectSupportedImageFormat(bytes);
  if (!format) return NextResponse.json({ error: "That file is not a valid JPG, PNG, or WebP image." }, { status: 400 });
  const objectKey = `providers/${access.providerId}/portfolio/${randomUUID()}.${format.extension}`;
  let publicUrl = "";
  try {
    publicUrl = await uploadPublicImage({ key: objectKey, body: bytes, contentType: format.contentType });
    const item = await database.query(
      `INSERT INTO provider_portfolio_items (provider_id, service_id, object_key, public_url, caption, alt_text, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id::text, public_url AS url, caption, alt_text, service_id::text, sort_order, moderation_status`,
      [access.providerId, serviceId, objectKey, publicUrl, caption, altText, Number(count.rows[0]?.count ?? 0)],
    );
    await recordActivity({ userId: access.session.user.id, action: "provider_portfolio_uploaded", targetType: "provider", targetId: access.providerId });
    return NextResponse.json({ item: item.rows[0] });
  } catch (error) {
    if (publicUrl) await deleteImage(objectKey).catch(() => undefined);
    console.error("Portfolio upload failed", error);
    return NextResponse.json({ error: "We could not upload that portfolio image." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const access = await ownerAccess();
  if (!access) return NextResponse.json({ error: "Only the business owner can manage the portfolio." }, { status: 403 });
  const body = await request.json().catch(() => null) as { orderedIds?: unknown } | null;
  if (!Array.isArray(body?.orderedIds) || body.orderedIds.length > PROVIDER_PROFILE_LIMITS.portfolio || body.orderedIds.some((id) => typeof id !== "string")) return NextResponse.json({ error: "Invalid portfolio order." }, { status: 400 });
  const owned = await database.query<{ id: string }>("SELECT id::text FROM provider_portfolio_items WHERE provider_id::text = $1", [access.providerId]);
  const ownedIds = new Set(owned.rows.map((row) => row.id));
  const orderedIds = body.orderedIds as string[];
  if (orderedIds.length !== ownedIds.size || new Set(orderedIds).size !== orderedIds.length || orderedIds.some((id) => !ownedIds.has(id))) return NextResponse.json({ error: "Portfolio order did not match your images." }, { status: 400 });
  const client = await database.connect();
  try { await client.query("BEGIN"); for (const [index, id] of orderedIds.entries()) await client.query("UPDATE provider_portfolio_items SET sort_order = $3, updated_at = now() WHERE id::text = $1 AND provider_id::text = $2", [id, access.providerId, index]); await client.query("COMMIT"); }
  catch (error) { await client.query("ROLLBACK"); console.error("Portfolio reorder failed", error); return NextResponse.json({ error: "We could not reorder the portfolio." }, { status: 500 }); }
  finally { client.release(); }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const access = await ownerAccess();
  if (!access) return NextResponse.json({ error: "Only the business owner can manage the portfolio." }, { status: 403 });
  const body = await request.json().catch(() => null) as { id?: unknown } | null;
  if (typeof body?.id !== "string") return NextResponse.json({ error: "Choose a portfolio image." }, { status: 400 });
  const removed = await database.query<{ object_key: string }>("DELETE FROM provider_portfolio_items WHERE id::text = $1 AND provider_id::text = $2 RETURNING object_key", [body.id, access.providerId]);
  if (!removed.rows[0]) return NextResponse.json({ error: "Portfolio image not found." }, { status: 404 });
  await deleteImage(removed.rows[0].object_key).catch((error) => console.error("Portfolio storage cleanup failed", error));
  await recordActivity({ userId: access.session.user.id, action: "provider_portfolio_removed", targetType: "provider", targetId: access.providerId });
  return NextResponse.json({ ok: true });
}
