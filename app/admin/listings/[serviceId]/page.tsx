import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { database } from "@/lib/database";
import { formatDuration, getServiceVisual } from "@/lib/marketplace";
import { getAdminSession } from "@/lib/admin";

export const dynamic = "force-dynamic";

type ListingPreview = {
  id: string; title: string; category: string; description: string; price_cents: number;
  duration_minutes: number; is_active: boolean; business_name: string; city: string;
  state: string; service_radius_miles: number; image_urls: string[] | null;
};

export default async function AdminListingPreviewPage({ params }: PageProps<"/admin/listings/[serviceId]">) {
  const session = await getAdminSession();
  if (!session) redirect("/login?redirect=/admin");
  const { serviceId } = await params;
  const result = await database.query<ListingPreview>(
    `SELECT s.id::text, s.title, s.category, s.description, s.price_cents, s.duration_minutes,
            s.is_active, s.business_name, p.city, p.state, p.service_radius_miles,
            COALESCE((SELECT array_agg(si.public_url ORDER BY si.sort_order, si.created_at)
              FROM service_images si WHERE si.service_id = s.id), ARRAY[]::text[]) AS image_urls
     FROM services s
     JOIN provider_profiles p ON p.id = s.provider_id
     WHERE s.id::text = $1
     LIMIT 1`,
    [serviceId],
  );
  const listing = result.rows[0];
  if (!listing) notFound();
  const visual = getServiceVisual(listing.category);
  const images = listing.image_urls ?? [];

  return <main className="min-h-screen bg-[#f8f7f3] text-[#183126]"><header className="border-b border-[#183126]/10 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6"><Link href="/admin" className="flex items-center gap-2 text-xl font-bold"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#183126] text-[#eee25a]">B</span>BubsBookings</Link><span className="rounded-full bg-[#eee25a] px-3 py-1 text-xs font-extrabold uppercase tracking-wider">Admin preview</span></div></header><div className="mx-auto max-w-6xl px-4 py-8 sm:px-6"><Link href="/admin" className="text-sm font-bold text-[#5f7268] hover:text-[#183126]">← Back to admin listings</Link><div className="mt-6 rounded-2xl border border-[#d9ca55] bg-[#fff8cf] p-4 text-sm"><strong>This is an admin-only preview.</strong> {listing.is_active ? "The listing is currently visible in the marketplace." : "The listing is currently removed from the marketplace."}</div><div className="mt-7 grid gap-7 lg:grid-cols-[1.25fr_.75fr]"><section><div role="img" aria-label={`${listing.title} cover`} style={images[0] ? { backgroundImage: `url("${images[0]}")` } : undefined} className={`relative h-72 overflow-hidden rounded-[2.5rem] bg-cover bg-center sm:h-[420px] ${images[0] ? "bg-[#e5e8e2]" : `bg-gradient-to-br ${visual.gradient}`}`}>{!images[0] && <span className="absolute bottom-8 right-10 text-8xl opacity-80 sm:text-9xl">{visual.art}</span>}<span className="absolute left-6 top-6 rounded-full bg-white/90 px-4 py-2 text-xs font-bold">{listing.is_active ? "Active listing" : "Removed listing"}</span></div>{images.length > 1 && <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">{images.slice(1).map((url, index) => <div key={url} role="img" aria-label={`${listing.title} photo ${index + 2}`} style={{ backgroundImage: `url("${url}")` }} className="aspect-[4/3] rounded-2xl bg-cover bg-center" />)}</div>}<p className="mt-8 text-sm font-bold uppercase tracking-[.15em] text-[#6c7d74]">{listing.category}</p><h1 className="mt-3 text-4xl font-bold tracking-[-.045em] sm:text-5xl">{listing.title}</h1><p className="mt-5 text-sm text-[#718078]">📍 {listing.city}, {listing.state} · Served by <strong className="text-[#183126]">{listing.business_name}</strong></p><p className="mt-7 max-w-2xl text-lg leading-8 text-[#5b6d64]">{listing.description}</p></section><aside className="h-fit rounded-[2rem] border border-[#183126]/10 bg-white p-7 shadow-[0_20px_50px_rgba(24,49,38,.10)]"><p className="text-xs font-bold uppercase tracking-wider text-[#718078]">Starting price</p><p className="mt-2 text-4xl font-bold">${(listing.price_cents / 100).toFixed(2)}</p><div className="mt-6 space-y-3 text-sm"><p className="rounded-2xl bg-[#f5f5ef] p-4"><strong>Typical duration</strong><span className="mt-1 block text-[#687970]">{formatDuration(listing.duration_minutes)}</span></p><p className="rounded-2xl bg-[#f5f5ef] p-4"><strong>Provider working radius</strong><span className="mt-1 block text-[#687970]">Within {listing.service_radius_miles} miles of {listing.city}</span></p></div></aside></div></div></main>;
}
