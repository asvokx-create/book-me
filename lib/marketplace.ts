import "server-only";

import { database, isDatabaseConfigured } from "./database";

export type ServiceListing = {
  id: string;
  slug: string;
  title: string;
  category: string;
  description: string;
  price: number;
  durationMinutes: number;
  providerId: string;
  provider: string;
  city: string;
  state: string;
  imageUrls: string[];
};

type ServiceRow = {
  id: string;
  slug: string;
  title: string;
  category: string;
  description: string;
  price_cents: number;
  duration_minutes: number;
  provider_id: string;
  business_name: string;
  city: string;
  state: string;
  image_urls: string[] | null;
};

function mapService(row: ServiceRow): ServiceListing {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    category: row.category,
    description: row.description,
    price: row.price_cents / 100,
    durationMinutes: row.duration_minutes,
    providerId: row.provider_id,
    provider: row.business_name,
    city: row.city,
    state: row.state,
    imageUrls: row.image_urls ?? [],
  };
}

export async function getServices(options: { query?: string; category?: string; location?: string; limit?: number } = {}) {
  if (!isDatabaseConfigured()) return [];

  const values: Array<string | number> = [];
  const conditions = ["s.is_active = true", "p.is_active = true"];
  if (options.category && options.category !== "All services") {
    values.push(options.category);
    conditions.push(`LOWER(s.category) = LOWER($${values.length})`);
  }
  if (options.query) {
    values.push(`%${options.query}%`);
    conditions.push(`(s.title ILIKE $${values.length} OR s.category ILIKE $${values.length} OR p.business_name ILIKE $${values.length})`);
  }
  if (options.location) {
    const city = options.location.split(",")[0]?.trim();
    if (city) {
      values.push(city);
      conditions.push(`LOWER(p.city) = LOWER($${values.length})`);
    }
  }
  values.push(options.limit ?? 50);

  const result = await database.query<ServiceRow>(
    `SELECT s.id::text, s.slug, s.title, s.category, s.description, s.price_cents,
            s.duration_minutes, p.id::text AS provider_id,
            p.business_name, p.city, p.state,
            COALESCE((
              SELECT array_agg(si.public_url ORDER BY si.sort_order, si.created_at)
              FROM service_images si WHERE si.service_id = s.id
            ), ARRAY[]::text[]) AS image_urls
     FROM services s
     JOIN provider_profiles p ON p.id = s.provider_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY s.created_at DESC
     LIMIT $${values.length}`,
    values,
  );
  return result.rows.map(mapService);
}

export async function getServiceBySlug(slug: string) {
  if (!isDatabaseConfigured()) return null;
  const result = await database.query<ServiceRow>(
    `SELECT s.id::text, s.slug, s.title, s.category, s.description, s.price_cents,
            s.duration_minutes, p.id::text AS provider_id,
            p.business_name, p.city, p.state,
            COALESCE((
              SELECT array_agg(si.public_url ORDER BY si.sort_order, si.created_at)
              FROM service_images si WHERE si.service_id = s.id
            ), ARRAY[]::text[]) AS image_urls
     FROM services s
     JOIN provider_profiles p ON p.id = s.provider_id
     WHERE s.slug = $1 AND s.is_active = true AND p.is_active = true
     LIMIT 1`,
    [slug],
  );
  return result.rows[0] ? mapService(result.rows[0]) : null;
}

export async function getServiceById(id: string) {
  if (!isDatabaseConfigured()) return null;
  const result = await database.query<ServiceRow>(
    `SELECT s.id::text, s.slug, s.title, s.category, s.description, s.price_cents,
            s.duration_minutes, p.id::text AS provider_id,
            p.business_name, p.city, p.state,
            COALESCE((
              SELECT array_agg(si.public_url ORDER BY si.sort_order, si.created_at)
              FROM service_images si WHERE si.service_id = s.id
            ), ARRAY[]::text[]) AS image_urls
     FROM services s
     JOIN provider_profiles p ON p.id = s.provider_id
     WHERE s.id::text = $1 AND s.is_active = true AND p.is_active = true
     LIMIT 1`,
    [id],
  );
  return result.rows[0] ? mapService(result.rows[0]) : null;
}

export async function getProviderById(id: string) {
  if (!isDatabaseConfigured()) return null;
  const providerResult = await database.query<{
    id: string;
    business_name: string;
    bio: string;
    city: string;
    state: string;
    is_verified: boolean;
  }>(
    `SELECT p.id::text, p.business_name, p.bio, p.city, p.state,
            p.is_verified
     FROM provider_profiles p
     WHERE p.id::text = $1 AND p.is_active = true
     LIMIT 1`,
    [id],
  );
  const provider = providerResult.rows[0];
  if (!provider) return null;

  const services = await getServicesForProvider(provider.id);
  return {
    id: provider.id,
    businessName: provider.business_name,
    bio: provider.bio,
    city: provider.city,
    state: provider.state,
    isVerified: provider.is_verified,
    services,
  };
}

async function getServicesForProvider(providerId: string) {
  const result = await database.query<ServiceRow>(
    `SELECT s.id::text, s.slug, s.title, s.category, s.description, s.price_cents,
            s.duration_minutes, p.id::text AS provider_id,
            p.business_name, p.city, p.state,
            COALESCE((
              SELECT array_agg(si.public_url ORDER BY si.sort_order, si.created_at)
              FROM service_images si WHERE si.service_id = s.id
            ), ARRAY[]::text[]) AS image_urls
     FROM services s
     JOIN provider_profiles p ON p.id = s.provider_id
     WHERE p.id = $1 AND s.is_active = true
     ORDER BY s.created_at DESC`,
    [providerId],
  );
  return result.rows.map(mapService);
}

export async function getFavoriteServices(customerId: string) {
  if (!isDatabaseConfigured()) return [];
  const result = await database.query<ServiceRow>(
    `SELECT s.id::text, s.slug, s.title, s.category, s.description, s.price_cents,
            s.duration_minutes, p.id::text AS provider_id,
            p.business_name, p.city, p.state,
            COALESCE((
              SELECT array_agg(si.public_url ORDER BY si.sort_order, si.created_at)
              FROM service_images si WHERE si.service_id = s.id
            ), ARRAY[]::text[]) AS image_urls
     FROM favorites f
     JOIN services s ON s.id = f.service_id
     JOIN provider_profiles p ON p.id = s.provider_id
     WHERE f.customer_id = $1 AND s.is_active = true AND p.is_active = true
     ORDER BY f.created_at DESC`,
    [customerId],
  );
  return result.rows.map(mapService);
}

export function formatDuration(minutes: number) {
  if (minutes >= 480) return "Full day";
  if (minutes >= 240) return "Half day";
  const hours = minutes / 60;
  return `${hours} ${hours === 1 ? "hour" : "hours"}`;
}

export function getServiceVisual(category: string) {
  const normalized = category.toLowerCase();
  if (normalized.includes("car")) return { art: "🚙", gradient: "from-emerald-950 via-emerald-700 to-lime-300" };
  if (normalized.includes("lawn") || normalized.includes("garden") || normalized.includes("landscap")) return { art: "🌱", gradient: "from-lime-800 via-lime-600 to-yellow-200" };
  if (normalized.includes("clean")) return { art: "🏡", gradient: "from-amber-900 via-amber-600 to-orange-100" };
  if (normalized.includes("photo")) return { art: "📷", gradient: "from-indigo-900 via-violet-600 to-pink-200" };
  return { art: "🧰", gradient: "from-slate-800 via-emerald-700 to-amber-200" };
}
