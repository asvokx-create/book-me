import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { deleteImage, uploadPublicImage } from "@/lib/spaces";
import { PLAN_ENTITLEMENTS, type ProviderPlan } from "@/lib/plans";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

function hasValidSignature(buffer: Buffer, type: string) {
  if (type === "image/jpeg") return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (type === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (type === "image/webp") return buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP";
  return false;
}

export async function POST(request: Request, { params }: { params: Promise<{ serviceId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Log in before adding listing photos." }, { status: 401 });

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
  if (!allowedTypes.has(image.type)) return NextResponse.json({ error: "Use a JPG, PNG, or WebP photo." }, { status: 400 });
  if (image.size === 0 || image.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: "Each photo must be under 5 MB." }, { status: 400 });

  const body = Buffer.from(await image.arrayBuffer());
  if (!hasValidSignature(body, image.type)) return NextResponse.json({ error: "That file does not appear to be a valid image." }, { status: 400 });

  const objectKey = `services/${serviceId}/${randomUUID()}.${allowedTypes.get(image.type)}`;
  let publicUrl = "";
  try {
    publicUrl = await uploadPublicImage({ key: objectKey, body, contentType: image.type });
    const result = await database.query<{ id: string; public_url: string; sort_order: number }>(
      `INSERT INTO service_images (service_id, object_key, public_url, sort_order)
       VALUES ($1, $2, $3, $4)
       RETURNING id::text, public_url, sort_order`,
      [serviceId, objectKey, publicUrl, imageCount],
    );
    return NextResponse.json({
      image: { id: result.rows[0].id, url: result.rows[0].public_url, sortOrder: result.rows[0].sort_order },
    });
  } catch (error) {
    if (publicUrl) await deleteImage(objectKey).catch(() => undefined);
    console.error("Listing photo upload failed", error);
    return NextResponse.json({ error: "We could not upload that photo. Please try again." }, { status: 500 });
  }
}
