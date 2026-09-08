import "server-only";

import { database, isDatabaseConfigured } from "@/lib/database";

export type CompanyPage = {
  id: string;
  slug: string;
  name: string;
  bio: string;
  city: string;
  state: string;
  ownerName: string;
  verified: boolean;
  services: Array<{
    id: string;
    slug: string;
    title: string;
    category: string;
    description: string;
    price: number;
    imageUrl: string;
  }>;
};

export async function getCompanyBySlug(slug: string): Promise<CompanyPage | null> {
  if (!isDatabaseConfigured()) return null;
  const companyResult = await database.query<{
    id: string; slug: string; name: string; bio: string; city: string; state: string;
    owner_name: string; verified: boolean;
  }>(
    `SELECT company.id::text, company.slug, company.name, company.bio, company.city, company.state,
            owner.name AS owner_name, provider.is_verified AS verified
     FROM provider_companies company
     JOIN provider_profiles provider ON provider.id = company.provider_id AND provider.is_active = true
     JOIN "user" owner ON owner.id = provider.user_id
     WHERE company.slug = $1 AND company.is_active = true
     LIMIT 1`,
    [slug],
  );
  const company = companyResult.rows[0];
  if (!company) return null;
  const serviceResult = await database.query<{
    id: string; slug: string; title: string; category: string; description: string;
    price_cents: number; image_url: string | null;
  }>(
    `SELECT service.id::text, service.slug, service.title, service.category, service.description,
            service.price_cents,
            (SELECT image.public_url FROM service_images image WHERE image.service_id = service.id ORDER BY image.sort_order, image.created_at LIMIT 1) AS image_url
     FROM services service
     WHERE service.company_id::text = $1 AND service.is_active = true
     ORDER BY service.created_at DESC`,
    [company.id],
  );
  return {
    id: company.id,
    slug: company.slug,
    name: company.name,
    bio: company.bio,
    city: company.city,
    state: company.state,
    ownerName: company.owner_name,
    verified: company.verified,
    services: serviceResult.rows.map((service) => ({
      id: service.id,
      slug: service.slug,
      title: service.title,
      category: service.category,
      description: service.description,
      price: service.price_cents / 100,
      imageUrl: service.image_url ?? "",
    })),
  };
}
