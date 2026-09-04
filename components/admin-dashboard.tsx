"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";

type AdminSection = "overview" | "reports" | "moderation" | "accounts" | "listings" | "reviews" | "audit";
type Stats = {
  users: number; active_providers: number; active_services: number; bookings_30d: number;
  open_reports: number; blocked_30d: number;
};
type SafetyReport = {
  id: string; category: string; details: string; status: string; created_at: string;
  reporter_name: string; reporter_email: string; reported_name: string; reported_email: string;
  service_title: string;
};
type ModerationEvent = {
  id: string; surface: string; category: string; severity: string; action: string;
  created_at: string; user_name: string; user_email: string;
};
type Account = {
  id: string; name: string; email: string; role: string; created_at: string;
  restriction_status: string | null; restriction_reason: string | null;
  provider_id: string | null; business_name: string | null; provider_active: boolean | null;
};
type Listing = {
  id: string; title: string; category: string; is_active: boolean; price_cents: number;
  created_at: string; business_name: string; provider_id: string;
};
type Review = {
  id: string; rating: number; body: string; is_hidden: boolean; created_at: string;
  customer_name: string; customer_email: string; service_title: string; business_name: string;
};
type AuditEntry = {
  id: string; action: string; target_type: string; target_id: string;
  details: Record<string, unknown>; created_at: string; actor_name: string;
};
type DashboardData = {
  stats: Stats; reports: SafetyReport[]; events: ModerationEvent[];
  accounts: Account[]; listings: Listing[]; reviews: Review[]; audit: AuditEntry[];
};

const navItems: Array<{ id: AdminSection; label: string; icon: string }> = [
  { id: "overview", label: "Overview", icon: "▦" },
  { id: "reports", label: "Safety reports", icon: "⚑" },
  { id: "moderation", label: "Safety Bot", icon: "◇" },
  { id: "accounts", label: "Accounts", icon: "◎" },
  { id: "listings", label: "Listings", icon: "▤" },
  { id: "reviews", label: "Reviews", icon: "☆" },
  { id: "audit", label: "Audit history", icon: "↺" },
];

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function StatusPill({ value }: { value: string }) {
  const warning = ["open", "critical", "high", "suspended", "banned", "inactive"].includes(value);
  const success = ["active", "resolved"].includes(value);
  const color = warning
    ? "bg-[#fff0e7] text-[#9a4e25]"
    : success
      ? "bg-[#e5f1e5] text-[#34704a]"
      : "bg-[#f5f0c9] text-[#78681f]";
  return <span className={"rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider " + color}>{label(value)}</span>;
}

export default function AdminDashboard({ adminName }: { adminName: string }) {
  const router = useRouter();
  const [section, setSection] = useState<AdminSection>("overview");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/admin", { cache: "no-store" }).catch(() => null);
    if (!response?.ok) {
      setError("The admin dashboard could not be loaded.");
      setLoading(false);
      return;
    }
    setData(await response.json() as DashboardData);
    setError("");
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/admin", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<DashboardData> : null)
      .catch(() => null)
      .then((result) => {
        if (!active) return;
        if (result) {
          setData(result);
          setError("");
        } else setError("The admin dashboard could not be loaded.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function runAction(options: {
    action: string; targetId: string; status?: string; needsReason?: boolean;
    confirmText?: string; successText: string;
  }) {
    if (options.confirmText && !window.confirm(options.confirmText)) return;
    let reason = "";
    if (options.needsReason) {
      reason = window.prompt("Add a clear reason. This is saved in the audit history.")?.trim() ?? "";
      if (!reason) return;
    }
    setBusyId(options.targetId);
    setError("");
    const response = await fetch("/api/admin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: options.action, targetId: options.targetId, status: options.status, reason }),
    }).catch(() => null);
    const result = response ? await response.json() as { error?: string } : null;
    if (!response?.ok) setError(result?.error ?? "That change could not be saved.");
    else {
      setNotice(options.successText);
      await load();
    }
    setBusyId("");
  }

  async function signOut() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  const firstName = adminName.trim().split(/\s+/)[0] || "Admin";
  const initials = adminName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "A";
  const openReports = data?.reports.filter((report) => report.status === "open" || report.status === "reviewing") ?? [];
  const criticalEvents = data?.events.filter((event) => event.severity === "critical" || event.severity === "high") ?? [];
  const statCards = data ? [
    { label: "Total accounts", value: data.stats.users, detail: "Customers and providers" },
    { label: "Active providers", value: data.stats.active_providers, detail: "Visible businesses" },
    { label: "Active listings", value: data.stats.active_services, detail: "Bookable services" },
    { label: "Bookings", value: data.stats.bookings_30d, detail: "Last 30 days" },
    { label: "Open reports", value: data.stats.open_reports, detail: "Needs review" },
    { label: "Safety blocks", value: data.stats.blocked_30d, detail: "Last 30 days" },
  ] : [];

  return (
    <main className="min-h-screen bg-[#f4f4ef] text-[#183126]">
      <header className="border-b border-[#183126]/10 bg-white">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2.5 text-xl font-bold">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#183126] text-[#eee25a]">B</span>
              BookMe
            </Link>
            <span className="hidden rounded-full bg-[#eee25a] px-3 py-1 text-xs font-extrabold uppercase tracking-wider sm:inline">Admin</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/account" className="rounded-full px-4 py-2 text-sm font-bold transition hover:bg-[#e4ecdf]">View marketplace</Link>
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[#e5eddf] text-sm font-bold">{initials}</span>
            <button onClick={signOut} className="rounded-full px-3 py-2 text-sm font-bold text-[#66766e] transition hover:bg-[#fff0e7] hover:text-[#8d4827]">Log out</button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1440px] gap-6 px-5 py-7 lg:grid-cols-[240px_1fr] lg:px-8">
        <aside className="rounded-[1.5rem] bg-[#183126] p-3 text-white lg:min-h-[calc(100vh-8rem)]">
          <div className="px-4 pb-5 pt-3">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[#aabdb3]">Admin console</p>
            <p className="mt-2 text-lg font-bold">Hi, {firstName}</p>
          </div>
          <nav className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1" aria-label="Admin sections">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={"flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold transition " + (section === item.id ? "bg-[#eee25a] text-[#183126]" : "text-white/80 hover:bg-white/10 hover:text-white")}
              >
                <span className="w-5 text-center">{item.icon}</span>{item.label}
                {item.id === "reports" && openReports.length > 0 && <span className="ml-auto rounded-full bg-[#fff0e7] px-2 py-0.5 text-[10px] text-[#9a4e25]">{openReports.length}</span>}
              </button>
            ))}
          </nav>
        </aside>

        <section className="min-w-0">
          <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#718078]">Marketplace operations</p>
              <h1 className="mt-2 text-3xl font-bold tracking-[-.04em] sm:text-4xl">{navItems.find((item) => item.id === section)?.label}</h1>
            </div>
            <button onClick={() => void load()} disabled={loading} className="self-start rounded-full border border-[#183126]/15 bg-white px-5 py-2.5 text-sm font-bold transition hover:bg-[#eee25a] disabled:opacity-50 sm:self-auto">
              {loading ? "Refreshing…" : "↻ Refresh"}
            </button>
          </div>

          {notice && <div role="status" className="mb-5 flex items-center justify-between rounded-2xl bg-[#e4f0e2] px-5 py-4 text-sm font-bold text-[#34704a]"><span>✓ {notice}</span><button onClick={() => setNotice("")} className="rounded-full px-2 py-1 hover:bg-white/60" aria-label="Dismiss">×</button></div>}
          {error && <div role="alert" className="mb-5 rounded-2xl bg-[#fff0e7] px-5 py-4 text-sm font-bold text-[#9a4e25]">{error}</div>}
          {loading && !data && <div className="rounded-[2rem] bg-white p-12 text-center text-[#718078]">Loading your admin console…</div>}

          {data && section === "overview" && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {statCards.map((stat) => <div key={stat.label} className="rounded-[1.7rem] border border-[#183126]/10 bg-white p-6 shadow-[0_16px_40px_rgba(24,49,38,.05)]"><p className="text-xs font-extrabold uppercase tracking-[.13em] text-[#718078]">{stat.label}</p><p className="mt-3 text-4xl font-bold tracking-tight">{stat.value}</p><p className="mt-2 text-sm text-[#718078]">{stat.detail}</p></div>)}
              </div>
              <div className="grid gap-5 xl:grid-cols-2">
                <div className="rounded-[1.7rem] border border-[#183126]/10 bg-white p-6">
                  <div className="flex items-center justify-between"><div><h2 className="text-xl font-bold">Needs attention</h2><p className="mt-1 text-sm text-[#718078]">Reports waiting for an admin decision.</p></div><button onClick={() => setSection("reports")} className="rounded-full px-4 py-2 text-sm font-bold transition hover:bg-[#eee25a]">View all →</button></div>
                  <div className="mt-5 space-y-3">{openReports.slice(0, 4).map((report) => <button key={report.id} onClick={() => setSection("reports")} className="flex w-full items-center gap-4 rounded-2xl bg-[#f7f7f2] p-4 text-left transition hover:bg-[#f1edc7]"><span className="grid h-10 w-10 place-items-center rounded-full bg-[#fff0e7]">⚑</span><span className="min-w-0 flex-1"><span className="block truncate font-bold">{report.reported_name}</span><span className="block truncate text-xs text-[#718078]">{label(report.category)} · {report.service_title}</span></span><StatusPill value={report.status} /></button>)}{openReports.length === 0 && <p className="rounded-2xl bg-[#f7f7f2] p-5 text-sm text-[#718078]">No open safety reports. You’re all caught up.</p>}</div>
                </div>
                <div className="rounded-[1.7rem] border border-[#183126]/10 bg-white p-6">
                  <div className="flex items-center justify-between"><div><h2 className="text-xl font-bold">High-risk blocks</h2><p className="mt-1 text-sm text-[#718078]">Recent Safety Bot activity.</p></div><button onClick={() => setSection("moderation")} className="rounded-full px-4 py-2 text-sm font-bold transition hover:bg-[#eee25a]">Review →</button></div>
                  <div className="mt-5 space-y-3">{criticalEvents.slice(0, 4).map((event) => <button key={event.id} onClick={() => setSection("moderation")} className="flex w-full items-center gap-4 rounded-2xl bg-[#f7f7f2] p-4 text-left transition hover:bg-[#f1edc7]"><span className="grid h-10 w-10 place-items-center rounded-full bg-[#fff0e7]">◇</span><span className="min-w-0 flex-1"><span className="block truncate font-bold">{event.user_name}</span><span className="block truncate text-xs text-[#718078]">{label(event.category)} · {label(event.surface)}</span></span><StatusPill value={event.severity} /></button>)}{criticalEvents.length === 0 && <p className="rounded-2xl bg-[#f7f7f2] p-5 text-sm text-[#718078]">No high-risk events in the recent activity.</p>}</div>
                </div>
              </div>
            </div>
          )}

          {data && section === "reports" && (
            <div className="space-y-4">
              {data.reports.map((report) => (
                <article key={report.id} className="rounded-[1.7rem] border border-[#183126]/10 bg-white p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><StatusPill value={report.status} /><span className="text-xs font-bold uppercase tracking-wider text-[#718078]">{label(report.category)}</span></div><h2 className="mt-3 text-xl font-bold">{report.reported_name} was reported</h2><p className="mt-1 text-sm text-[#718078]">{report.service_title} · {formatDate(report.created_at)}</p></div><div className="flex flex-wrap gap-2">{report.status === "open" && <button disabled={busyId === report.id} onClick={() => void runAction({ action: "report_status", targetId: report.id, status: "reviewing", successText: "Report marked as under review." })} className="rounded-full border border-[#183126]/15 px-4 py-2 text-sm font-bold transition hover:bg-[#eee25a]">Start review</button>}<button disabled={busyId === report.id} onClick={() => void runAction({ action: "report_status", targetId: report.id, status: "resolved", confirmText: "Mark this safety report as resolved?", successText: "Report resolved." })} className="rounded-full bg-[#183126] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#315846]">Resolve</button><button disabled={busyId === report.id} onClick={() => void runAction({ action: "report_status", targetId: report.id, status: "dismissed", confirmText: "Dismiss this safety report?", successText: "Report dismissed." })} className="rounded-full px-4 py-2 text-sm font-bold transition hover:bg-[#fff0e7]">Dismiss</button></div></div>
                  <div className="mt-5 grid gap-4 rounded-2xl bg-[#f7f7f2] p-5 md:grid-cols-2"><div><p className="text-xs font-extrabold uppercase tracking-wider text-[#718078]">Reported by</p><p className="mt-2 font-bold">{report.reporter_name}</p><p className="text-sm text-[#718078]">{report.reporter_email}</p></div><div><p className="text-xs font-extrabold uppercase tracking-wider text-[#718078]">Reported account</p><p className="mt-2 font-bold">{report.reported_name}</p><p className="text-sm text-[#718078]">{report.reported_email}</p></div>{report.details && <div className="md:col-span-2"><p className="text-xs font-extrabold uppercase tracking-wider text-[#718078]">Details</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{report.details}</p></div>}</div>
                </article>
              ))}
              {data.reports.length === 0 && <EmptyState title="No safety reports" body="Customer and provider reports will appear here." />}
            </div>
          )}

          {data && section === "moderation" && (
            <div className="overflow-hidden rounded-[1.7rem] border border-[#183126]/10 bg-white">
              <div className="border-b border-[#183126]/10 p-6"><h2 className="text-xl font-bold">Safety Bot activity</h2><p className="mt-1 text-sm text-[#718078]">Privacy-safe records. Blocked message text is not stored here.</p></div>
              <div className="divide-y divide-[#183126]/10">{data.events.map((event) => <div key={event.id} className="grid gap-3 p-5 sm:grid-cols-[1.2fr_1fr_auto] sm:items-center"><div><p className="font-bold">{event.user_name}</p><p className="text-sm text-[#718078]">{event.user_email}</p></div><div><p className="text-sm font-bold">{label(event.category)} · {label(event.surface)}</p><p className="mt-1 text-xs text-[#718078]">{formatDate(event.created_at)}</p></div><StatusPill value={event.severity} /></div>)}</div>
              {data.events.length === 0 && <EmptyState title="No blocked content" body="Safety Bot activity will appear here when content is stopped." />}
            </div>
          )}

          {data && section === "accounts" && (
            <div className="space-y-4">
              {data.accounts.map((account) => (
                <article key={account.id} className="rounded-[1.7rem] border border-[#183126]/10 bg-white p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#e5eddf] font-bold">{account.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>
                    <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold">{account.name}</h2><StatusPill value={account.restriction_status ?? "active"} /><span className="rounded-full bg-[#f0f1eb] px-2.5 py-1 text-[10px] font-bold uppercase">{account.role}</span></div><p className="mt-1 break-all text-sm text-[#718078]">{account.email}</p><p className="mt-1 text-xs text-[#8a9690]">Joined {formatDate(account.created_at)}{account.business_name ? " · " + account.business_name : ""}</p>{account.restriction_reason && <p className="mt-2 text-xs font-semibold text-[#9a4e25]">Reason: {account.restriction_reason}</p>}</div>
                    <div className="flex flex-wrap gap-2">
                      <button disabled={busyId === account.id} onClick={() => void runAction({ action: "warn_account", targetId: account.id, needsReason: true, successText: "Warning sent to the account." })} className="rounded-full border border-[#183126]/15 px-4 py-2 text-xs font-bold transition hover:bg-[#eee25a]">Warn</button>
                      {account.restriction_status ? <button disabled={busyId === account.id} onClick={() => void runAction({ action: "account_status", targetId: account.id, status: "active", confirmText: "Restore this account and allow it to sign in?", successText: "Account restored." })} className="rounded-full bg-[#34704a] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#285b3b]">Restore</button> : <>
                        <button disabled={busyId === account.id} onClick={() => void runAction({ action: "account_status", targetId: account.id, status: "suspended", needsReason: true, confirmText: "Suspend this account and sign it out everywhere?", successText: "Account suspended and signed out." })} className="rounded-full bg-[#9a4e25] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#7b3c1b]">Suspend</button>
                        <button disabled={busyId === account.id} onClick={() => void runAction({ action: "account_status", targetId: account.id, status: "banned", needsReason: true, confirmText: "Permanently ban this account and sign it out everywhere?", successText: "Account banned and signed out." })} className="rounded-full bg-[#521f1f] px-4 py-2 text-xs font-bold text-white transition hover:bg-black">Ban</button>
                      </>}
                      {account.provider_id && <button disabled={busyId === account.provider_id} onClick={() => void runAction({ action: "provider_status", targetId: account.provider_id!, status: account.provider_active ? "inactive" : "active", confirmText: account.provider_active ? "Pause this provider and hide all of their services?" : "Restore this provider profile?", successText: account.provider_active ? "Provider profile paused." : "Provider profile restored." })} className="rounded-full px-4 py-2 text-xs font-bold transition hover:bg-[#e5eddf]">{account.provider_active ? "Pause provider" : "Restore provider"}</button>}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {data && section === "listings" && (
            <div className="grid gap-4 xl:grid-cols-2">
              {data.listings.map((listing) => <article key={listing.id} className="rounded-[1.7rem] border border-[#183126]/10 bg-white p-6"><div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><StatusPill value={listing.is_active ? "active" : "inactive"} /><span className="text-xs font-bold uppercase tracking-wider text-[#718078]">{listing.category}</span></div><h2 className="mt-3 text-xl font-bold">{listing.title}</h2><p className="mt-1 text-sm text-[#718078]">{listing.business_name} · {"$" + (listing.price_cents / 100).toFixed(0)}</p><p className="mt-2 text-xs text-[#8a9690]">Added {formatDate(listing.created_at)}</p></div><button disabled={busyId === listing.id} onClick={() => void runAction({ action: "listing_status", targetId: listing.id, status: listing.is_active ? "inactive" : "active", confirmText: listing.is_active ? "Remove this listing from the marketplace?" : "Restore this listing to the marketplace?", successText: listing.is_active ? "Listing removed." : "Listing restored." })} className={"shrink-0 rounded-full px-4 py-2 text-xs font-bold transition " + (listing.is_active ? "bg-[#fff0e7] text-[#9a4e25] hover:bg-[#f8d9ca]" : "bg-[#34704a] text-white hover:bg-[#285b3b]")}>{listing.is_active ? "Remove" : "Restore"}</button></div></article>)}
              {data.listings.length === 0 && <EmptyState title="No listings yet" body="Provider services will appear here." />}
            </div>
          )}

          {data && section === "reviews" && (
            <div className="grid gap-4 xl:grid-cols-2">
              {data.reviews.map((review) => <article key={review.id} className="rounded-[1.7rem] border border-[#183126]/10 bg-white p-6"><div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><StatusPill value={review.is_hidden ? "hidden" : "active"} /><span className="text-[#d0a51d]">{"★".repeat(review.rating)}<span className="text-[#d8ddd9]">{"★".repeat(5 - review.rating)}</span></span></div><h2 className="mt-3 font-bold">{review.customer_name}</h2><p className="mt-1 text-xs text-[#718078]">{review.customer_email} · {review.service_title}</p><p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[#52665b]">{review.body || "No written comment."}</p><p className="mt-3 text-xs text-[#8a9690]">{review.business_name} · {formatDate(review.created_at)}</p></div><button disabled={busyId === review.id} onClick={() => void runAction({ action: "review_status", targetId: review.id, status: review.is_hidden ? "visible" : "hidden", confirmText: review.is_hidden ? "Restore this review?" : "Hide this review from BookMe?", successText: review.is_hidden ? "Review restored." : "Review hidden." })} className={"shrink-0 rounded-full px-4 py-2 text-xs font-bold transition " + (review.is_hidden ? "bg-[#34704a] text-white hover:bg-[#285b3b]" : "bg-[#fff0e7] text-[#9a4e25] hover:bg-[#f8d9ca]")}>{review.is_hidden ? "Restore" : "Hide"}</button></div></article>)}
              {data.reviews.length === 0 && <EmptyState title="No reviews yet" body="Verified customer reviews will appear here." />}
            </div>
          )}

          {data && section === "audit" && (
            <div className="overflow-hidden rounded-[1.7rem] border border-[#183126]/10 bg-white">
              <div className="border-b border-[#183126]/10 p-6"><h2 className="text-xl font-bold">Permanent action history</h2><p className="mt-1 text-sm text-[#718078]">A record of marketplace decisions for accountability.</p></div>
              <div className="divide-y divide-[#183126]/10">{data.audit.map((entry) => <div key={entry.id} className="grid gap-2 p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-center"><div><p className="font-bold">{label(entry.action)}</p><p className="mt-1 text-sm text-[#718078]">by {entry.actor_name}</p></div><div><p className="text-sm font-semibold">{label(entry.target_type)}</p><p className="mt-1 max-w-xs truncate text-xs text-[#8a9690]">{entry.target_id}</p></div><time className="text-xs font-semibold text-[#718078]">{formatDate(entry.created_at)}</time></div>)}</div>
              {data.audit.length === 0 && <EmptyState title="No admin actions yet" body="Warnings, account restrictions, and review decisions will be recorded here." />}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="col-span-full p-10 text-center"><p className="text-3xl">✓</p><h3 className="mt-3 text-lg font-bold">{title}</h3><p className="mt-2 text-sm text-[#718078]">{body}</p></div>;
}
