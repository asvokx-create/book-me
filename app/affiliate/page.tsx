import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import BrandLockup from "@/components/brand-lockup";
import AffiliateLinkBuilder from "@/components/affiliate-link-builder";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";

export const metadata: Metadata = { title: "Partner dashboard", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
const ranges: Record<string, string> = { "7d": "7 days", "30d": "30 days", "90d": "90 days", ytd: "year", all: "all" };
function money(cents: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100); }

export default async function AffiliateDashboardPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login?redirect=/affiliate");
  const requested = (await searchParams).range ?? "30d";
  const range = requested in ranges ? requested : "30d";
  const since = range === "all" ? null : range === "ytd" ? "year" : `${Number(range.slice(0, -1))} days`;
  const profileResult = await database.query<{
    id: string; display_name: string; affiliate_code: string | null; status: string; program_name: string;
  }>(`SELECT affiliate.id::text, affiliate.display_name, affiliate.affiliate_code, affiliate.status, program.name AS program_name
      FROM affiliate_profiles affiliate JOIN affiliate_programs program ON program.id = affiliate.program_id
      WHERE affiliate.user_id = $1 OR (affiliate.user_id IS NULL AND lower(affiliate.email) = lower($2))
      ORDER BY affiliate.created_at DESC LIMIT 1`, [session.user.id, session.user.email]);
  const profile = profileResult.rows[0];
  if (!profile) return <main className="min-h-screen bg-[#f8f7f3] text-[#183126]"><div className="reading-container px-5 py-16"><Link href="/"><BrandLockup /></Link><div className="mt-10 rounded-[2rem] border border-[#183126]/10 bg-white p-8"><h1 className="text-3xl font-bold">No partner account yet</h1><p className="mt-3 leading-7 text-[#687970]">Apply to the BubsBookings partner program. Applications are reviewed before referral links and commissions are activated.</p><Link href="/partners#apply" className="mt-6 inline-flex rounded-full bg-[#eee25a] px-6 py-3 font-bold">Apply now</Link></div></div></main>;
  await database.query(`UPDATE affiliate_profiles SET user_id = $1 WHERE id = $2::uuid AND user_id IS NULL`, [session.user.id, profile.id]);
  if (!profile.affiliate_code || !["active", "paused"].includes(profile.status)) return <main className="min-h-screen bg-[#f8f7f3] text-[#183126]"><div className="reading-container px-5 py-16"><Link href="/"><BrandLockup /></Link><div className="mt-10 rounded-[2rem] bg-white p-8"><p className="text-xs font-bold uppercase tracking-wider text-[#687970]">Application status</p><h1 className="mt-2 text-3xl font-bold capitalize">{profile.status.replace("_", " ")}</h1><p className="mt-3 leading-7 text-[#687970]">{profile.status === "approved" ? "Your application is approved and awaiting activation. Referral attribution begins only after BubsBookings activates your partner account." : "Your application is not active yet. BubsBookings will review it before issuing a referral code."}</p></div></div></main>;

  const [statsResult, referralsResult, commissionsResult, payoutsResult] = await Promise.all([
    database.query<{ clicks: number; signups: number; active_referrals: number; qualified: number; bookings: number; eligible_revenue: number; pending: number; payable: number; paid: number; lifetime_earnings: number }>(`SELECT
      (SELECT count(*)::int FROM affiliate_clicks WHERE affiliate_id = $1 AND ($2::text IS NULL OR created_at >= CASE WHEN $2='year' THEN date_trunc('year',now()) ELSE now()-$2::interval END)) AS clicks,
      (SELECT count(*)::int FROM affiliate_referrals WHERE affiliate_id = $1 AND ($2::text IS NULL OR attributed_at >= CASE WHEN $2='year' THEN date_trunc('year',now()) ELSE now()-$2::interval END)) AS signups,
      (SELECT count(*)::int FROM affiliate_referrals WHERE affiliate_id = $1 AND status <> 'disqualified'
        AND (revenue_share_ends_at IS NULL OR revenue_share_ends_at >= now())) AS active_referrals,
      (SELECT count(*)::int FROM affiliate_referrals WHERE affiliate_id = $1 AND qualified_at IS NOT NULL AND ($2::text IS NULL OR qualified_at >= CASE WHEN $2='year' THEN date_trunc('year',now()) ELSE now()-$2::interval END)) AS qualified,
      (SELECT count(DISTINCT booking_id)::int FROM affiliate_commissions WHERE affiliate_id = $1 AND booking_id IS NOT NULL AND ($2::text IS NULL OR created_at >= CASE WHEN $2='year' THEN date_trunc('year',now()) ELSE now()-$2::interval END)) AS bookings,
      (SELECT COALESCE(sum(eligible_revenue_cents),0)::int FROM affiliate_commissions WHERE affiliate_id = $1 AND commission_type = 'revenue_share' AND status <> 'reversed' AND ($2::text IS NULL OR created_at >= CASE WHEN $2='year' THEN date_trunc('year',now()) ELSE now()-$2::interval END)) AS eligible_revenue,
      (SELECT COALESCE(sum(amount_cents),0)::int FROM affiliate_commissions WHERE affiliate_id = $1 AND status IN ('pending','hold','approved') AND ($2::text IS NULL OR created_at >= CASE WHEN $2='year' THEN date_trunc('year',now()) ELSE now()-$2::interval END)) AS pending,
      (SELECT COALESCE(sum(amount_cents),0)::int FROM affiliate_commissions WHERE affiliate_id = $1 AND status = 'payable' AND ($2::text IS NULL OR created_at >= CASE WHEN $2='year' THEN date_trunc('year',now()) ELSE now()-$2::interval END)) AS payable,
      (SELECT COALESCE(sum(amount_cents),0)::int FROM affiliate_commissions WHERE affiliate_id = $1 AND status = 'paid' AND ($2::text IS NULL OR created_at >= CASE WHEN $2='year' THEN date_trunc('year',now()) ELSE now()-$2::interval END)) AS paid,
      (SELECT COALESCE(sum(amount_cents),0)::int FROM affiliate_commissions WHERE affiliate_id = $1 AND status IN ('pending','hold','approved','payable','paid')) AS lifetime_earnings`, [profile.id, since]),
    database.query<{ business_name: string; attributed_at: Date; status: string; revenue_share_ends_at: Date | null; commission_cents: number }>(`SELECT provider.business_name, referral.attributed_at, referral.status, referral.revenue_share_ends_at,
      COALESCE(sum(commission.amount_cents) FILTER (WHERE commission.status <> 'reversed'),0)::int AS commission_cents
      FROM affiliate_referrals referral JOIN provider_profiles provider ON provider.id = referral.provider_id
      LEFT JOIN affiliate_commissions commission ON commission.referral_id = referral.id
      WHERE referral.affiliate_id = $1 GROUP BY referral.id, provider.business_name ORDER BY referral.attributed_at DESC LIMIT 25`, [profile.id]),
    database.query<{ id: string; commission_type: string; amount_cents: number; status: string; created_at: Date; business_name: string }>(`SELECT commission.id::text, commission.commission_type, commission.amount_cents, commission.status, commission.created_at, provider.business_name
      FROM affiliate_commissions commission JOIN provider_profiles provider ON provider.id = commission.provider_id
      WHERE commission.affiliate_id = $1 ORDER BY commission.created_at DESC LIMIT 25`, [profile.id]),
    database.query<{ id: string; amount_cents: number; status: string; paid_at: Date | null; created_at: Date; payout_reference: string | null }>(`SELECT id::text, amount_cents, status, paid_at, created_at, payout_reference FROM affiliate_payouts WHERE affiliate_id = $1 ORDER BY created_at DESC LIMIT 20`, [profile.id]),
  ]);
  const stats = statsResult.rows[0];
  const conversion = stats.clicks ? Math.round(stats.signups / stats.clicks * 1000) / 10 : 0;
  return <main className="min-h-screen bg-[#f8f7f3] text-[#183126]"><header className="border-b border-[#183126]/10 bg-white"><div className="dashboard-container flex items-center justify-between px-5 py-4"><Link href="/"><BrandLockup /></Link><Link href="/account" className="rounded-full border border-[#183126]/15 px-5 py-2.5 text-sm font-bold">Account</Link></div></header>
    <div className="dashboard-container px-5 py-10"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#687970]">{profile.program_name}</p><h1 className="mt-2 text-4xl font-bold tracking-tight">Welcome, {profile.display_name}</h1><p className="mt-2 text-sm text-[#687970]">Code <strong className="text-[#183126]">{profile.affiliate_code}</strong> · <span className="capitalize">{profile.status}</span></p></div><nav className="flex flex-wrap gap-2" aria-label="Analytics date range">{Object.entries(ranges).map(([key, label]) => <Link key={key} href={`/affiliate?range=${key}`} className={`rounded-full px-4 py-2 text-xs font-bold ${range === key ? "bg-[#183126] text-white" : "border border-[#183126]/15 bg-white"}`}>{label === "year" ? "Year to date" : label === "all" ? "All time" : `Last ${label}`}</Link>)}</nav></div>
    {profile.status === "paused" ? <div role="status" className="mt-6 rounded-2xl border border-[#b05a3c]/20 bg-[#fff1e8] p-4 text-sm leading-6"><strong>Your partner account is paused.</strong> Historical reporting remains available, but your referral link will not attribute new providers until the account is reactivated.</div> : null}
    <section className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["Clicks", stats.clicks], ["Provider signups", stats.signups], ["Active referrals", stats.active_referrals], ["Qualified providers", stats.qualified], ["Signup conversion", `${conversion}%`], ["Bookings generated", stats.bookings], ["Eligible platform revenue", money(stats.eligible_revenue)], ["Pending commissions", money(stats.pending)], ["Payable balance", money(stats.payable)], ["Paid commissions", money(stats.paid)], ["Lifetime earnings", money(stats.lifetime_earnings)]].map(([label,value]) => <article key={label} className="rounded-2xl border border-[#183126]/10 bg-white p-5"><p className="text-xs font-bold uppercase tracking-wider text-[#718078]">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></article>)}</section>
    {profile.status === "active" ? <div className="mt-7"><AffiliateLinkBuilder code={profile.affiliate_code} /></div> : null}
    <div className="mt-7 grid gap-6 xl:grid-cols-2"><section className="rounded-[1.75rem] border border-[#183126]/10 bg-white p-5"><h2 className="text-xl font-bold">Referred providers</h2><div className="mt-4 grid gap-3">{referralsResult.rows.length ? referralsResult.rows.map((item) => <article key={`${item.business_name}-${item.attributed_at.toISOString()}`} className="rounded-2xl bg-[#f6f7f2] p-4"><div className="flex flex-wrap justify-between gap-2"><strong>{item.business_name}</strong><span className="text-sm font-bold capitalize">{item.status.replaceAll("_", " ")}</span></div><p className="mt-1 text-xs text-[#687970]">Joined {item.attributed_at.toLocaleDateString()} · Commission {money(item.commission_cents)}{item.revenue_share_ends_at ? ` · Share ends ${item.revenue_share_ends_at.toLocaleDateString()}` : ""}</p></article>) : <p className="text-sm text-[#687970]">No attributed providers in this view yet.</p>}</div></section>
    <section className="rounded-[1.75rem] border border-[#183126]/10 bg-white p-5"><h2 className="text-xl font-bold">Recent commissions</h2><div className="mt-4 grid gap-3">{commissionsResult.rows.length ? commissionsResult.rows.map((item) => <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#f6f7f2] p-4"><div><strong className="capitalize">{item.commission_type.replaceAll("_", " ")}</strong><p className="text-xs text-[#687970]">{item.business_name} · {item.created_at.toLocaleDateString()}</p></div><div className="text-right"><p className="font-bold">{money(item.amount_cents)}</p><p className="text-xs font-bold capitalize text-[#687970]">{item.status}</p></div></article>) : <p className="text-sm text-[#687970]">No commissions yet.</p>}</div></section></div>
    <section className="mt-7 rounded-[1.75rem] border border-[#183126]/10 bg-white p-5"><h2 className="text-xl font-bold">Payout history</h2><p className="mt-1 text-sm text-[#687970]">Affiliate payouts are reviewed and issued separately from provider payouts.</p><div className="mt-4 grid gap-3">{payoutsResult.rows.length ? payoutsResult.rows.map((item) => <article key={item.id} className="flex flex-wrap justify-between gap-3 rounded-2xl bg-[#f6f7f2] p-4"><div><strong>{money(item.amount_cents)}</strong><p className="text-xs text-[#687970]">{(item.paid_at ?? item.created_at).toLocaleDateString()} {item.payout_reference ? `· ${item.payout_reference}` : ""}</p></div><span className="text-sm font-bold capitalize">{item.status}</span></article>) : <p className="text-sm text-[#687970]">No payouts issued yet.</p>}</div></section>
    </div></main>;
}
