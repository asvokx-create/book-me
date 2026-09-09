import type { MetadataRoute } from "next";
import { getServices } from "@/lib/marketplace";
import { SERVICE_AREAS, serviceAreaSlug } from "@/lib/service-areas";
import { serviceCategorySlug } from "@/lib/service-categories";
import { GUIDES } from "@/lib/guides";

const baseUrl = "https://bubsbookings.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const services = await getServices({ limit: 1000 }).catch(() => []);
  const providerIds = [...new Set(services.map((service) => service.providerId))];
  const companySlugs = [...new Set(services.map((service) => service.companySlug).filter((slug): slug is string => Boolean(slug)))];
  const localCategoryPages = [...new Map(services.flatMap((service) => {
    const area = SERVICE_AREAS.find((candidate) => candidate.city.toLowerCase() === service.city.toLowerCase() && candidate.state.toLowerCase() === service.state.toLowerCase());
    if (!area) return [];
    const url = `${baseUrl}/locations/${serviceAreaSlug(area)}/${serviceCategorySlug(service.category)}`;
    return [[url, { url, changeFrequency: "daily" as const, priority: 0.85 }]] as const;
  })).values()];
  const staticPages = ["", "/services", "/pricing", "/providers/join", "/locations", "/guides", "/promise", "/terms", "/privacy", "/provider-agreement", "/ai-transparency"];

  return [
    ...staticPages.map((path) => ({ url: `${baseUrl}${path}`, changeFrequency: path === "" || path === "/services" ? "daily" as const : "monthly" as const, priority: path === "" ? 1 : path === "/services" ? 0.9 : 0.5 })),
    ...SERVICE_AREAS.map((area) => ({ url: `${baseUrl}/locations/${serviceAreaSlug(area)}`, changeFrequency: "daily" as const, priority: 0.7 })),
    ...localCategoryPages,
    ...GUIDES.map((guide) => ({ url: `${baseUrl}/guides/${guide.slug}`, lastModified: guide.updatedAt, changeFrequency: "monthly" as const, priority: 0.6 })),
    ...services.map((service) => ({ url: `${baseUrl}/services/${service.slug}`, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...companySlugs.map((slug) => ({ url: `${baseUrl}/companies/${slug}`, changeFrequency: "weekly" as const, priority: 0.75 })),
    ...providerIds.map((providerId) => ({ url: `${baseUrl}/providers/${providerId}`, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}
