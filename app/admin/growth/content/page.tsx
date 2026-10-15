import { redirect } from "next/navigation";
import BackButton from "@/components/back-button";
import AdminSocialContentStudio from "@/components/admin-social-content-studio";
import { getAdminSession } from "@/lib/admin";
import { database } from "@/lib/database";
export const dynamic = "force-dynamic";
export default async function AdminGrowthContentPage() {
  const session = await getAdminSession();
  if (!session) redirect("/login?redirect=/admin/growth/content");
  const result = await database.query<{ id: string; title: string; business_name: string; category: string; city: string; state: string; slug: string }>(`SELECT service.id::text,service.title,company.name AS business_name,service.category,location.city,location.state,service.slug FROM services service JOIN provider_profiles provider ON provider.id=service.provider_id AND provider.is_active=true AND provider.age_verification_status='verified' JOIN provider_companies company ON company.id=service.company_id AND company.is_active=true JOIN provider_locations location ON location.id=service.location_id AND location.is_active=true WHERE service.is_active=true AND service.delivery_type <> 'REMOTE' ORDER BY service.created_at DESC LIMIT 100`);
  const services = result.rows.map((service) => ({ id: service.id, title: service.title, businessName: service.business_name, category: service.category, city: service.city, state: service.state, slug: service.slug }));
  return <main className="min-h-screen bg-[#f4f4ef] px-4 py-7 text-[#183126] sm:px-8 sm:py-8"><div className="mx-auto max-w-6xl"><div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#718078]">Admin growth</p><h1 className="mt-2 text-3xl font-bold">Social content</h1></div><BackButton label="Back to growth" fallbackHref="/admin/growth" /></div><AdminSocialContentStudio services={services} /></div></main>;
}
