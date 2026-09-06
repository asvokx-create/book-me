import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { deleteImage, uploadPublicImage } from "@/lib/spaces";
import { PLAN_ENTITLEMENTS, type ProviderPlan } from "@/lib/plans";
import { enforceRateLimit, recordActivity } from "@/lib/request-security";
import { LISTING_IMAGE_MAX_BYTES, LISTING_IMAGE_MAX_MB } from "@/lib/listing-images";
import { detectSupportedImageFormat } from "@/lib/image-format";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ serviceId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Log in before adding listing photos." }, { status: 401 });
  if (!await enforceRateLimit({ request, userId: session.user.id, bucket: "image-upload", limit: 12, windowSeconds: 3600 })) {
    return NextResponse.json({ error: "Too many photo uploads. Please try again later." }, { status: 429 });
  }

  const { serviceId } = await params;
  const ownership = await database.query<{ image_count: string; total_image_count: string; plan: ProviderPlan }>(
    `SELECT COUNT(si.id)::text AS image_count, p.plan,
            (SELECT COUNT(*)::text FROM service_images all_images
             JOIN services provider_service ON provider_service.id = all_images.service_id
             WHERE provider_service.provider_id = p.id AND provider_service.is_active = true) AS total_image_count
     FROM services s
     JOIN provider_profiles p ON p.id = s.provider_id
     LEFT JOIN service_images si ON si.service_id = s.id
     WHERE s.id::text = $1 AND p.user_id = $2
     GROUP BY s.id, p.id, p.plan`,
    [serviceId, session.user.id],
  );
  if (!ownership.rows[0]) return NextResponse.json({ error: "Service not found." }, { status: 404 });

  const imageCount = Number(ownership.rows[0].image_count);
  const photoLimit = PLAN_ENTITLEMENTS[ownership.rows[0].plan].photoLimit;
  if (photoLimit !== null && Number(ownership.rows[0].total_image_count) >= photoLimit) {
    return NextResponse.json({ error: `Your ${PLAN_ENTITLEMENTS[ownership.rows[0].plan].name} plan allows ${photoLimit} photos across all listings. Upgrade from Billing for unlimited photos.`, upgradeRequired: true }, { status: 403 });
  }

  const formData = await request.formData();
  const image = formData.get("image");
  if (!(image instanceof File)) return NextResponse.json({ error: "Choose a photo to upload." }, { status: 400 });
  if (image.size === 0 || image.size > LISTING_IMAGE_MAX_BYTES) return NextResponse.json({ error: `Each photo must be under ${LISTING_IMAGE_MAX_MB} MB.` }, { status: 400 });

  const body = Buffer.from(await image.arrayBuffer());
  const imageFormat = detectSupportedImageFormat(body);
  if (!imageFormat) return NextResponse.json({ error: "That file does not appear to be a valid JPG, PNG, or WebP image." }, { status: 400 });

  const objectKey = `services/${serviceId}/${randomUUID()}.${imageFormat.extension}`;
  let publicUrl = "";
  try {
    publicUrl = await uploadPublicImage({ key: objectKey, body, contentType: imageFormat.contentType });
    const result = await database.query<{ id: string; public_url: string; sort_order: number }>(
      `INSERT INTO service_images (service_id, object_key, public_url, sort_order)
       VALUES ($1, $2, $3, $4)
       RETURNING id::text, public_url, sort_order`,
      [serviceId, objectKey, publicUrl, imageCount],
    );
    await recordActivity({ userId: session.user.id, action: "service_image_uploaded", targetType: "service", targetId: serviceId });
    return NextResponse.json({
      image: { id: result.rows[0].id, url: result.rows[0].public_url, sortOrder: result.rows[0].sort_order },
    });
  } catch (error) {
    if (publicUrl) await deleteImage(objectKey).catch(() => undefined);
    console.error("Listing photo upload failed", error);
    return NextResponse.json({ error: "We could not upload that photo. Please try again." }, { status: 500 });
  }
}
