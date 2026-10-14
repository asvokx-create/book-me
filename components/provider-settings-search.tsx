"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import UiIcon from "@/components/ui-icon";

const settingDestinations = [
  { title: "Account settings", description: "Name, phone, location, notifications, password, security, and age confirmation", href: "/account/settings", keywords: "account name phone email password security age notification theme dark light timezone" },
  { title: "Business profile", description: "Business details, public profile, and listing information", href: "/providers/join", keywords: "business profile company public information" },
  { title: "Services and pricing", description: "Listings, prices, descriptions, duration, and photos", href: "/provider/dashboard/services", keywords: "service listing price pricing hourly photos description" },
  { title: "Service locations", description: "Branches, service areas, and worker coverage", href: "/provider/dashboard/locations", keywords: "location city state service area branch radius coverage" },
  { title: "Availability", description: "Days and times customers can request", href: "/provider/dashboard/availability", keywords: "availability calendar hours schedule time" },
  { title: "Company team", description: "Workers, roles, and team access", href: "/provider/dashboard/team", keywords: "team worker employee member role invite" },
  { title: "Plan and billing", description: "Provider plan, payments, Stripe payouts, and verification", href: "/provider/dashboard/billing", keywords: "billing plan stripe payout payment age verification subscription" },
] as const;

export default function ProviderSettingsSearch() {
  const [query, setQuery] = useState("");
  const recommendations = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return settingDestinations
      .map((item) => ({ ...item, score: terms.reduce((total, term) => total + (`${item.title} ${item.description} ${item.keywords}`.toLowerCase().includes(term) ? 1 : 0), 0) }))
      .filter((item) => item.score > 0)
      .sort((first, second) => second.score - first.score || first.title.localeCompare(second.title))
      .slice(0, 5);
  }, [query]);

  return <>
    <style jsx global>{`
      /* Keep the hub cards neutral; Account settings signals interactivity on hover. */
      .dashboard-content a[href="/account/settings"]:has(> span:first-child) {
        background: #f5f5ef !important;
        color: #183126 !important;
      }
      .dashboard-content a[href="/account/settings"]:has(> span:first-child):hover {
        background: #183126 !important;
        color: #fff !important;
      }
    `}</style>
    <section className="provider-settings-search relative mb-6 rounded-[1.5rem] border border-[#183126]/10 bg-white p-4 sm:p-5" aria-labelledby="provider-settings-search-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div className="min-w-0 sm:w-52"><p className="text-xs font-bold uppercase tracking-[.13em] text-[#718078]">Quick find</p><h1 id="provider-settings-search-title" className="mt-1 text-lg font-bold">Search settings</h1></div><div className="relative min-w-0 flex-1"><label className="sr-only" htmlFor="provider-settings-search">Search provider settings</label><UiIcon name="search" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#718078]" /><input id="provider-settings-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try “payouts,” “services,” or “password”" autoComplete="off" className="w-full rounded-xl border border-[#183126]/15 bg-[#faf9f5] py-3 pl-11 pr-4 text-base outline-none transition focus:border-[#4d725d] focus:ring-2 focus:ring-[#4d725d]/10" /></div></div>
      {query.trim() && <div role="listbox" aria-label="Provider setting recommendations" className="mt-3 grid gap-2 sm:grid-cols-2">{recommendations.length ? recommendations.map((item) => <Link key={item.href} href={item.href} role="option" onClick={() => setQuery("")} className="group rounded-xl border border-[#183126]/10 bg-[#faf9f5] px-4 py-3 transition hover:border-[#315846] hover:bg-[#183126] hover:text-white"><span className="block text-sm font-bold">{item.title}</span><span className="mt-1 block text-xs leading-5 text-[#718078] transition group-hover:text-white">{item.description}</span></Link>) : <p className="col-span-full rounded-xl bg-[#faf9f5] px-4 py-3 text-sm text-[#718078]">No matching setting yet. Try “billing,” “location,” “services,” or “password.”</p>}</div>}
    </section>
  </>;
}
