import "server-only";

import { database, isDatabaseConfigured } from "./database";
import { distanceMiles, getServiceAreaCoordinates } from "./service-areas";

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
  emailVerified: boolean;
  phoneVerified: boolean;
  identityVerified: boolean;
  businessVerified: boolean;
  profileScreened: boolean;
  cancellationWindowHours: number;
  cancellationPolicy: string;
  noShowPolicy: string;
  distanceMiles?: number;
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
  email_verified: boolean;
  phone_verified: boolean;
  identity_verified: boolean;
  business_verified: boolean;
  is_verified: boolean;
  cancellation_window_hours: number;
  cancellation_policy: string;
  no_show_policy: string;
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
    emailVerified: row.email_verified,
    phoneVerified: row.phone_verified,
    identityVerified: row.identity_verified,
    businessVerified: row.business_verified,
    profileScreened: row.is_verified,
    cancellationWindowHours: row.cancellation_window_hours,
    cancellationPolicy: row.cancellation_policy,
    noShowPolicy: row.no_show_policy,
    imageUrls: row.image_urls ?? [],
  };
}

export async function getServices(options: { query?: string; category?: string; location?: string; radiusMiles?: number; maxPrice?: number; maxDuration?: number; sort?: string; limit?: number } = {}) {
  if (!isDatabaseConfigured()) return [];

  const values: Array<string | number> = [];
  const conditions = ["s.is_active = true", "p.is_active = true"];
  const requestedLimit = options.limit ?? 50;
  const radiusMiles = options.radiusMiles && Number.isFinite(options.radiusMiles) ? Math.min(Math.max(options.radiusMiles, 1), 100) : undefined;
  const searchOrigin = options.location && radiusMiles ? getServiceAreaCoordinates(options.location) : undefined;
  if (options.category && options.category !== "All services") {
    values.push(options.category);
    conditions.push(`LOWER(s.category) = LOWER($${values.length})`);
  }
  if (options.query) {
    values.push(`%${options.query}%`);
    conditions.push(`(s.title ILIKE $${values.length} OR s.category ILIKE $${values.length} OR p.business_name ILIKE $${values.length})`);
  }
  if (options.location && !searchOrigin) {
    const city = options.location.split(",")[0]?.trim();
    if (city) {
      values.push(city);
      conditions.push(`LOWER(p.city) = LOWER($${values.length})`);
    }
  }
  if (options.maxPrice && Number.isFinite(options.maxPrice)) {
    values.push(Math.round(options.maxPrice * 100));
    conditions.push(`s.price_cents <= $${values.length}`);
  }
  if (options.maxDuration && Number.isFinite(options.maxDuration)) {
    values.push(options.maxDuration);
    conditions.push(`s.duration_minutes <= $${values.length}`);
  }
  values.push(searchOrigin ? Math.max(requestedLimit, 200) : requestedLimit);

  const orderBy = options.sort === "price-low" ? "s.price_cents ASC, s.created_at DESC" : options.sort === "price-high" ? "s.price_cents DESC, s.created_at DESC" : "s.created_at DESC";
  const result = await database.query<ServiceRow>(
    `SELECT s.id::text, s.slug, s.title, s.category, s.description, s.price_cents,
            s.duration_minutes, p.id::text AS provider_id,
            p.business_name, p.city, p.state, owner."emailVerified" AS email_verified,
            p.is_verified, p.phone_verified, p.identity_verified, p.business_verified,
            p.cancellation_window_hours, p.cancellation_policy, p.no_show_policy,
            COALESCE((
              SELECT array_agg(si.public_url ORDER BY si.sort_order, si.created_at)
              FROM service_images si WHERE si.service_id = s.id
            ), ARRAY[]::text[]) AS image_urls
     FROM services s
     JOIN provider_profiles p ON p.id = s.provider_id
     JOIN "user" owner ON owner.id = p.user_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY ${orderBy}
     LIMIT $${values.length}`,
    values,
  );
  const services = result.rows.map(mapService);
  if (!searchOrigin || !radiusMiles) return services;
  const nearbyServices = services.flatMap((service) => {
    const serviceArea = getServiceAreaCoordinates(`${service.city}, ${service.state}`);
    if (!serviceArea) return [];
    const distance = distanceMiles(searchOrigin, serviceArea);
    return distance <= radiusMiles ? [{ ...service, distanceMiles: distance }] : [];
  });
  if (options.sort === "nearest" || !options.sort) nearbyServices.sort((left, right) => (left.distanceMiles ?? 0) - (right.distanceMiles ?? 0));
  return nearbyServices.slice(0, requestedLimit);
}

export async function getServiceBySlug(slug: string) {
  if (!isDatabaseConfigured()) return null;
  const result = await database.query<ServiceRow>(
    `SELECT s.id::text, s.slug, s.title, s.category, s.description, s.price_cents,
            s.duration_minutes, p.id::text AS provider_id,
            p.business_name, p.city, p.state, owner."emailVerified" AS email_verified,
            p.is_verified, p.phone_verified, p.identity_verified, p.business_verified,
            p.cancellation_window_hours, p.cancellation_policy, p.no_show_policy,
            COALESCE((
              SELECT array_agg(si.public_url ORDER BY si.sort_order, si.created_at)
              FROM service_images si WHERE si.service_id = s.id
            ), ARRAY[]::text[]) AS image_urls
     FROM services s
     JOIN provider_profiles p ON p.id = s.provider_id
     JOIN "user" owner ON owner.id = p.user_id
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
            p.business_name, p.city, p.state, owner."emailVerified" AS email_verified,
            p.is_verified, p.phone_verified, p.identity_verified, p.business_verified,
            p.cancellation_window_hours, p.cancellation_policy, p.no_show_policy,
            COALESCE((
              SELECT array_agg(si.public_url ORDER BY si.sort_order, si.created_at)
              FROM service_images si WHERE si.service_id = s.id
            ), ARRAY[]::text[]) AS image_urls
     FROM services s
     JOIN provider_profiles p ON p.id = s.provider_id
     JOIN "user" owner ON owner.id = p.user_id
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
    email_verified: boolean;
    phone_verified: boolean;
    identity_verified: boolean;
    business_verified: boolean;
    profile_image_url: string | null;
    cancellation_window_hours: number;
    cancellation_policy: string;
    no_show_policy: string;
  }>(
    `SELECT p.id::text, p.business_name, p.bio, p.city, p.state,
            p.is_verified, owner."emailVerified" AS email_verified, p.phone_verified,
            p.identity_verified, p.business_verified, p.cancellation_window_hours,
            p.cancellation_policy, p.no_show_policy, owner.image AS profile_image_url
     FROM provider_profiles p
     JOIN "user" owner ON owner.id = p.user_id
     WHERE p.id::text = $1 AND p.is_active = true
     LIMIT 1`,
    [id],
  );
  const provider = providerResult.rows[0];
  if (!provider) return null;

  const services = await getServicesForProvider(provider.id);
  const reviewsResult = await database.query<{ id: string; rating: number; body: string; customer_name: string; service_title: string; created_at: Date }>(
    `SELECT r.id::text, r.rating, r.body, customer.name AS customer_name,
            s.title AS service_title, r.created_at
     FROM reviews r
     JOIN bookings b ON b.id = r.booking_id AND b.status = 'completed'
     JOIN "user" customer ON customer.id = r.customer_id
     JOIN services s ON s.id = r.service_id
     WHERE r.provider_id::text = $1 AND r.is_hidden = false
     ORDER BY r.created_at DESC
     LIMIT 20`,
    [provider.id],
  );
  return {
    id: provider.id,
    businessName: provider.business_name,
    bio: provider.bio,
    city: provider.city,
    state: provider.state,
    isVerified: provider.is_verified,
    emailVerified: provider.email_verified,
    phoneVerified: provider.phone_verified,
    identityVerified: provider.identity_verified,
    businessVerified: provider.business_verified,
    profileImageUrl: provider.profile_image_url ?? "",
    cancellationWindowHours: provider.cancellation_window_hours,
    cancellationPolicy: provider.cancellation_policy,
    noShowPolicy: provider.no_show_policy,
    reviews: reviewsResult.rows.map((review) => ({ id: review.id, rating: review.rating, body: review.body, customerName: review.customer_name, serviceTitle: review.service_title, createdAt: review.created_at })),
    services,
  };
}

async function getServicesForProvider(providerId: string) {
  const result = await database.query<ServiceRow>(
    `SELECT s.id::text, s.slug, s.title, s.category, s.description, s.price_cents,
            s.duration_minutes, p.id::text AS provider_id,
            p.business_name, p.city, p.state, owner."emailVerified" AS email_verified,
            p.is_verified, p.phone_verified, p.identity_verified, p.business_verified,
            p.cancellation_window_hours, p.cancellation_policy, p.no_show_policy,
            COALESCE((
              SELECT array_agg(si.public_url ORDER BY si.sort_order, si.created_at)
              FROM service_images si WHERE si.service_id = s.id
            ), ARRAY[]::text[]) AS image_urls
     FROM services s
     JOIN provider_profiles p ON p.id = s.provider_id
     JOIN "user" owner ON owner.id = p.user_id
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
            p.business_name, p.city, p.state, owner."emailVerified" AS email_verified,
            p.is_verified, p.phone_verified, p.identity_verified, p.business_verified,
            p.cancellation_window_hours, p.cancellation_policy, p.no_show_policy,
            COALESCE((
              SELECT array_agg(si.public_url ORDER BY si.sort_order, si.created_at)
              FROM service_images si WHERE si.service_id = s.id
            ), ARRAY[]::text[]) AS image_urls
     FROM favorites f
     JOIN services s ON s.id = f.service_id
     JOIN provider_profiles p ON p.id = s.provider_id
     JOIN "user" owner ON owner.id = p.user_id
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
  if (normalized.includes("video")) return { art: "🎥", gradient: "from-zinc-950 via-red-800 to-orange-200" };
  if (normalized.includes("pet")) return { art: "🐾", gradient: "from-orange-800 via-amber-500 to-yellow-100" };
  if (normalized.includes("moving")) return { art: "📦", gradient: "from-sky-900 via-sky-600 to-cyan-200" };
  if (normalized.includes("training")) return { art: "🏋️", gradient: "from-slate-950 via-slate-600 to-lime-200" };
  if (normalized.includes("beauty") || normalized.includes("wellness")) return { art: "✨", gradient: "from-fuchsia-900 via-rose-500 to-pink-100" };
  if (normalized.includes("tutor")) return { art: "📚", gradient: "from-blue-900 via-indigo-600 to-amber-100" };
  if (normalized.includes("event")) return { art: "🎉", gradient: "from-purple-900 via-fuchsia-600 to-yellow-200" };
  if (normalized.includes("plumb")) return { art: "🚿", gradient: "from-cyan-900 via-cyan-600 to-sky-100" };
  if (normalized.includes("electric")) return { art: "⚡", gradient: "from-slate-900 via-blue-700 to-yellow-200" };
  if (normalized.includes("repair") || normalized.includes("appliance")) return { art: "🔧", gradient: "from-stone-900 via-emerald-700 to-orange-200" };
  return { art: "🧰", gradient: "from-slate-800 via-emerald-700 to-amber-200" };
}
