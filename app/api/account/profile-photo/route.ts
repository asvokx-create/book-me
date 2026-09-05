import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { deleteImage, uploadPublicImage } from "@/lib/spaces";
import { enforceRateLimit, recordActivity } from "@/lib/request-security";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const allowedTypes = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"]]);

function validImage(buffer: Buffer, type: string) {
  if (type === "image/jpeg") return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (type === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return type === "image/webp" && buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP";
}

async function currentImageKey(userId: string) {
  const result = await database.query<{ profile_image_key: string | null }>("SELECT profile_image_key FROM user_settings WHERE user_id = $1", [userId]);
  return result.rows[0]?.profile_image_key ?? null;
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Log in before adding a profile photo." }, { status: 401 });
  if (!await enforceRateLimit({ request, userId: session.user.id, bucket: "profile-photo", limit: 8, windowSeconds: 3600 })) return NextResponse.json({ error: "Too many photo changes. Please try again later." }, { status: 429 });
  const image = (await request.formData()).get("image");
  if (!(image instanceof File)) return NextResponse.json({ error: "Choose a photo to upload." }, { status: 400 });
  if (!allowedTypes.has(image.type) || image.size === 0 || image.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: "Choose a JPG, PNG, or WebP photo under 3 MB." }, { status: 400 });
  const body = Buffer.from(await image.arrayBuffer());
  if (!validImage(body, image.type)) return NextResponse.json({ error: "That file does not appear to be a valid image." }, { status: 400 });

  const previousKey = await currentImageKey(session.user.id);
  const objectKey = `profiles/${session.user.id}/${randomUUID()}.${allowedTypes.get(image.type)}`;
  let imageUrl = "";
  try {
    imageUrl = await uploadPublicImage({ key: objectKey, body, contentType: image.type });
    const client = await database.connect();
    try {
      await client.query("BEGIN");
      await client.query('UPDATE "user" SET image = $1, "updatedAt" = now() WHERE id = $2', [imageUrl, session.user.id]);
      await client.query(`INSERT INTO user_settings (user_id, profile_image_key) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET profile_image_key = EXCLUDED.profile_image_key`, [session.user.id, objectKey]);
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
    if (previousKey) await deleteImage(previousKey).catch(() => undefined);
    await recordActivity({ userId: session.user.id, action: "profile_photo_updated", targetType: "account", targetId: session.user.id });
    return NextResponse.json({ imageUrl });
  } catch (error) {
    if (imageUrl) await deleteImage(objectKey).catch(() => undefined);
    console.error("Profile photo upload failed", error);
    return NextResponse.json({ error: "We could not upload that photo. Please try again." }, { status: 500 });
  }
}

export async function DELETE() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const previousKey = await currentImageKey(session.user.id);
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    await client.query('UPDATE "user" SET image = NULL, "updatedAt" = now() WHERE id = $1', [session.user.id]);
    await client.query("UPDATE user_settings SET profile_image_key = NULL WHERE user_id = $1", [session.user.id]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Profile photo removal failed", error);
    return NextResponse.json({ error: "We could not remove that photo." }, { status: 500 });
  } finally {
    client.release();
  }
  if (previousKey) await deleteImage(previousKey).catch(() => undefined);
  await recordActivity({ userId: session.user.id, action: "profile_photo_removed", targetType: "account", targetId: session.user.id });
  return NextResponse.json({ ok: true });
}
