import "server-only";

import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

function getSpacesConfig() {
  // Read each variable directly so Next.js includes encrypted App Platform
  // variables in the server bundle. Dynamic process.env[name] access can miss
  // variables that are otherwise present in the deployed runtime.
  const region = process.env.SPACES_REGION;
  const bucket = process.env.SPACES_BUCKET;
  const accessKeyId = process.env.SPACES_KEY;
  const secretAccessKey = process.env.SPACES_SECRET;
  const missing = [
    !region && "SPACES_REGION",
    !bucket && "SPACES_BUCKET",
    !accessKeyId && "SPACES_KEY",
    !secretAccessKey && "SPACES_SECRET",
  ].filter((name): name is string => Boolean(name));
  if (!region || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(`Image storage is not configured. Missing: ${missing.join(", ")}`);
  }

  const endpoint = `https://${region}.digitaloceanspaces.com`;
  const publicBaseUrl = (process.env.SPACES_PUBLIC_URL || `https://${bucket}.${region}.digitaloceanspaces.com`).replace(/\/$/, "");

  return { region, bucket, endpoint, publicBaseUrl, accessKeyId, secretAccessKey };
}

function getSpacesClient() {
  const config = getSpacesConfig();
  return new S3Client({
    endpoint: config.endpoint,
    forcePathStyle: false,
    region: "us-east-1",
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
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
