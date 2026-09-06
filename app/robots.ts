import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/services", "/providers", "/pricing", "/locations", "/guides"],
      disallow: ["/account/", "/provider/dashboard/", "/admin/", "/api/"],
    },
    sitemap: "https://bubsbookings.com/sitemap.xml",
    host: "https://bubsbookings.com",
  };
}
