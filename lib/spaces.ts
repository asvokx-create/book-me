import "server-only";

import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const requiredVariables = ["SPACES_REGION", "SPACES_BUCKET", "SPACES_KEY", "SPACES_SECRET"] as const;

function getSpacesConfig() {
  const missing = requiredVariables.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Image storage is not configured. Missing: ${missing.join(", ")}`);
  }

  const region = process.env.SPACES_REGION!;
  const bucket = process.env.SPACES_BUCKET!;
  const endpoint = `https://${region}.digitaloceanspaces.com`;
  const publicBaseUrl = (process.env.SPACES_PUBLIC_URL || `https://${bucket}.${region}.digitaloceanspaces.com`).replace(/\/$/, "");

  return { region, bucket, endpoint, publicBaseUrl };
}

function getSpacesClient() {
  const config = getSpacesConfig();
  return new S3Client({
    endpoint: config.endpoint,
    forcePathStyle: false,
    region: "us-east-1",
    credentials: {
      accessKeyId: process.env.SPACES_KEY!,
      secretAccessKey: process.env.SPACES_SECRET!,
    },
  });
}

export async function uploadPublicImage(input: { key: string; body: Buffer; contentType: string }) {
  const config = getSpacesConfig();
  await getSpacesClient().send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: input.key,
    Body: input.body,
    ContentType: input.contentType,
    ACL: "public-read",
    CacheControl: "public, max-age=31536000, immutable",
  }));
  return `${config.publicBaseUrl}/${input.key}`;
}

export async function deleteImage(key: string) {
  const config = getSpacesConfig();
  await getSpacesClient().send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
}
