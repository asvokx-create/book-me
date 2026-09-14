"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import ProfileAvatar from "@/components/profile-avatar";
import { PLAN_ENTITLEMENTS, type ProviderPlan } from "@/lib/plans";

type AdminSection = "overview" | "reports" | "moderation" | "accounts" | "listings" | "reviews" | "payouts" | "audit";
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
  id: string; name: string; email: string; image: string | null; role: string; created_at: string;
  restriction_status: string | null; restriction_reason: string | null;
  provider_id: string | null; business_name: string | null; provider_plan: ProviderPlan | null; provider_active: boolean | null;
  phone_verified: boolean | null; identity_verified: boolean | null; business_verified: boolean | null;
};
type Listing = {
  id: string; slug: string; title: string; category: string; description: string; is_active: boolean; price_cents: number;
  created_at: string; business_name: string; city: string; state: string; provider_id: string;
};
type Review = {
  id: string; rating: number; body: string; is_hidden: boolean; created_at: string;
  customer_name: string; customer_email: string; service_title: string; business_name: string;
};
type AuditEntry = {
  id: string; action: string; target_type: string; target_id: string;
  details: Record<string, unknown>; created_at: string; actor_name: string;
};
type Payout = {
  id: string; payment_release_status: string; payment_status: string; provider_payout_cents: number;
  completion_confirmation_due_at: string | null; payout_released_at: string | null;
  payout_freeze_reason: string | null; payout_failure_reason: string | null; booking_status: string;
  created_at: string; customer_name: string; provider_name: string; service_title: string;
};
type DashboardData = {
  stats: Stats; reports: SafetyReport[]; events: ModerationEvent[];
  accounts: Account[]; listings: Listing[]; reviews: Review[]; payouts: Payout[]; audit: AuditEntry[];
};
type AdminActionOptions = {
  action: string; targetId: string; status?: string; needsReason?: boolean;
  confirmText?: string; successText: string;
};
type AccountDetails = {
  account: Account & {
    phone: string | null; email_verified: boolean; two_factor_enabled: boolean;
    terms_accepted_at: string | null; privacy_acknowledged_at: string | null;
    ai_safety_acknowledged_at: string | null; policy_version: string | null; updated_at: string;
    restriction_expires_at: string | null; restriction_created_at: string | null;
  };
  settings: null | { city: string; state: string; search_radius_miles: number; booking_notifications: boolean; message_notifications: boolean; theme: string; time_zone: string };
  consumerStripe: { connected: boolean; mode: "test" | "live" | null };
  provider: null | {
    id: string; business_name: string; bio: string; phone: string | null; city: string; state: string;
    service_radius_miles: number; plan: ProviderPlan; is_active: boolean; is_verified: boolean;
    phone_verified: boolean; identity_verified: boolean; business_verified: boolean;
    screening_status: string; screening_score: number | null; screening_summary: string; screening_checked_at: string | null;
    stripe_subscription_status: string; stripe_charges_enabled: boolean; stripe_payouts_enabled: boolean;
    stripe_current_period_end: string | null; stripe_connected: boolean;
    provider_agreement_accepted_at: string | null; provider_agreement_version: string | null;
    pro_trial_used_at_test: string | null; pro_trial_used_at_live: string | null; created_at: string; updated_at: string;
  };
  counts: { bookings: number; listings: number; reviews: number; safety_reports: number; disputes: number; support_requests: number };
  services: Array<{ id: string; slug: string; title: string; category: string; business_name: string; price_cents: number; duration_minutes: number; is_active: boolean; created_at: string }>;
  bookings: Array<{ id: string; service_title: string; status: string; payment_status: string; price_cents: number; starts_at: string; created_at: string; other_party_name: string; account_role: string }>;
  reviews: Array<{ id: string; rating: number; body: string; is_hidden: boolean; created_at: string; service_title: string; customer_name: string; relationship: string }>;
  reports: Array<{ id: string; category: string; details: string; status: string; created_at: string; reporter_name: string; reported_name: string; relationship: string }>;
  disputes: Array<{ id: string; category: string; details: string; requested_resolution: string; status: string; admin_note: string; created_at: string; service_title: string; opened_by_name: string; against_name: string }>;
  supportRequests: Array<{ id: string; subject: string; message: string; status: string; admin_reply: string; created_at: string }>;
  activity: Array<{ id: string; action: string; target_type: string; target_id: string | null; created_at: string }>;
  privacyNote: string;
};

const navItems: Array<{ id: AdminSection; label: string; icon: string }> = [
  { id: "overview", label: "Overview", icon: "▦" },
  { id: "reports", label: "Safety reports", icon: "⚑" },
  { id: "moderation", label: "Safety Bot", icon: "◇" },
  { id: "accounts", label: "Accounts", icon: "◎" },
  { id: "listings", label: "Listings", icon: "▤" },
  { id: "reviews", label: "Reviews", icon: "☆" },
  { id: "payouts", label: "Payouts", icon: "$" },
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
  const warning = ["open", "critical", "high", "suspended", "banned", "inactive", "frozen", "failed"].includes(value);
  const success = ["active", "resolved"].includes(value);
  const color = warning
    ? "bg-[#fff0e7] text-[#9a4e25]"
    : success
      ? "bg-[#e5f1e5] text-[#34704a]"
      : "bg-[#f5f0c9] text-[#78681f]";
  return <span className={"rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider " + color}>{label(value)}</span>;
}

export default function AdminDashboard({ adminName, adminImage = "" }: { adminName: string; adminImage?: string }) {
  const router = useRouter();
  const [section, setSection] = useState<AdminSection>("overview");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [accountSearch, setAccountSearch] = useState("");
  const [pendingAction, setPendingAction] = useState<AdminActionOptions | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [accountDetails, setAccountDetails] = useState<AccountDetails | null>(null);
  const [accountDetailsLoading, setAccountDetailsLoading] = useState(false);
  const [accountDetailsError, setAccountDetailsError] = useState("");

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

  async function runAction(options: AdminActionOptions) {
    if (options.confirmText) { setPendingAction(options); return; }
    await executeAction(options);
  }

  async function executeAction(options: AdminActionOptions) {
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
    const result = response ? await response.json() as { error?: string; message?: string } : null;
    if (!response?.ok) setError(result?.error ?? "That change could not be saved.");
    else {
      setNotice(result?.message ?? options.successText);
      await load();
    }
    setBusyId("");
    setPendingAction(null);
  }

  async function signOut() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  async function openAccount(account: Account) {
    setSelectedAccount(account);
    setAccountDetails(null);
    setAccountDetailsError("");
    setAccountDetailsLoading(true);
    const response = await fetch(`/api/admin/accounts/${encodeURIComponent(account.id)}`, { cache: "no-store" }).catch(() => null);
    const result = response ? await response.json() as AccountDetails & { error?: string } : null;
    if (!response?.ok || !result) setAccountDetailsError(result?.error ?? "The account details could not be loaded.");
    else setAccountDetails(result);
    setAccountDetailsLoading(false);
  }

  function closeAccount() {
    setSelectedAccount(null);
    setAccountDetails(null);
    setAccountDetailsError("");
  }

  useEffect(() => {
    if (!selectedAccount) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") closeAccount(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedAccount]);

  const firstName = adminName.trim().split(/\s+/)[0] || "Admin";
  const openReports = data?.reports.filter((report) => report.status === "open" || report.status === "reviewing") ?? [];
  const criticalEvents = data?.events.filter((event) => event.severity === "critical" || event.severity === "high") ?? [];
  const normalizedAccountSearch = accountSearch.trim().toLocaleLowerCase();
  const filteredAccounts = data?.accounts.filter((account) => {
    if (!normalizedAccountSearch) return true;
    return [account.name, account.email, account.role, account.business_name ?? ""]
      .some((value) => value.toLocaleLowerCase().includes(normalizedAccountSearch));
  }) ?? [];
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
              BubsBookings
            </Link>
            <span className="hidden rounded-full bg-[#eee25a] px-3 py-1 text-xs font-extrabold uppercase tracking-wider sm:inline">Admin</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/admin/reported-bugs" className="hidden rounded-full px-4 py-2 text-sm font-bold transition hover:bg-[#eee25a] md:inline-flex">Bug reports</Link>
            <Link href="/admin/disputes" className="hidden rounded-full px-4 py-2 text-sm font-bold transition hover:bg-[#eee25a] md:inline-flex">Disputes</Link>
            <Link href="/admin/support" className="hidden rounded-full px-4 py-2 text-sm font-bold transition hover:bg-[#eee25a] lg:inline-flex">Support</Link>
            <Link href="/admin/operations" className="hidden rounded-full px-4 py-2 text-sm font-bold transition hover:bg-[#eee25a] xl:inline-flex">Operations</Link>
            <Link href="/account" className="hidden rounded-full px-4 py-2 text-sm font-bold transition hover:bg-[#e4ecdf] sm:inline-flex">View marketplace</Link>
            <ProfileAvatar name={adminName} imageUrl={adminImage} className="h-10 w-10 text-sm" />
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
              <div className="rounded-[1.7rem] border border-[#183126]/10 bg-white p-5">
                <label htmlFor="admin-account-search" className="text-sm font-bold">Search accounts</label>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <span aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg">⌕</span>
                    <input
                      id="admin-account-search"
                      type="search"
                      value={accountSearch}
                      onChange={(event) => setAccountSearch(event.target.value)}
                      placeholder="Search by name, email, role, or business"
                      autoComplete="off"
                      className="w-full rounded-2xl border border-[#183126]/15 bg-[#fafaf6] py-3 pl-11 pr-4 text-sm outline-none transition placeholder:text-[#8a9690] focus:border-[#4d725d] focus:ring-2 focus:ring-[#4d725d]/20"
                    />
                  </div>
                  <p className="shrink-0 text-xs font-semibold text-[#718078]" aria-live="polite">
                    {normalizedAccountSearch ? `${filteredAccounts.length} of ${data.accounts.length} accounts` : `${data.accounts.length} accounts`}
                  </p>
                </div>
              </div>
              {filteredAccounts.map((account) => (
                <article key={account.id} className="rounded-[1.7rem] border border-[#183126]/10 bg-white p-5">
                  <div className="grid gap-4 2xl:grid-cols-[minmax(20rem,1fr)_minmax(0,2fr)] 2xl:items-center">
                    <button type="button" onClick={() => void openAccount(account)} className="group -m-2 flex min-w-0 items-start gap-4 rounded-2xl p-2 text-left transition hover:bg-[#f4f6f1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#34704a] sm:items-center" aria-label={`View ${account.name}'s account details`}>
                      <ProfileAvatar name={account.name} imageUrl={account.image} className="h-12 w-12 shrink-0 text-sm" />
                      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold group-hover:underline">{account.name}</h2><StatusPill value={account.restriction_status ?? "active"} /><span className="rounded-full bg-[#f0f1eb] px-2.5 py-1 text-[10px] font-bold uppercase">{account.role}</span>{account.provider_plan && <span className="rounded-full bg-[#fff3c4] px-2.5 py-1 text-[10px] font-extrabold uppercase text-[#775f00]">{PLAN_ENTITLEMENTS[account.provider_plan].name}</span>}</div><p className="mt-1 break-words text-sm text-[#718078] [overflow-wrap:anywhere]">{account.email}</p><p className="mt-1 text-xs text-[#8a9690]">Joined {formatDate(account.created_at)}{account.business_name ? " · " + account.business_name : ""}</p>{account.restriction_reason && <p className="mt-2 text-xs font-semibold text-[#9a4e25]">Reason: {account.restriction_reason}</p>}<span className="mt-2 inline-block text-xs font-bold text-[#34704a]">View account →</span></div>
                    </button>
                    <div className="flex flex-wrap gap-2 2xl:justify-end">
                      <button disabled={busyId === account.id} onClick={() => void runAction({ action: "warn_account", targetId: account.id, needsReason: true, successText: "Warning sent to the account." })} className="rounded-full border border-[#183126]/15 px-4 py-2 text-xs font-bold transition hover:bg-[#eee25a]">Warn</button>
                      {account.restriction_status ? <button disabled={busyId === account.id} onClick={() => void runAction({ action: "account_status", targetId: account.id, status: "active", confirmText: "Restore this account and allow it to sign in?", successText: "Account restored." })} className="rounded-full bg-[#34704a] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#285b3b]">Restore</button> : <>
                        <button disabled={busyId === account.id} onClick={() => void runAction({ action: "account_status", targetId: account.id, status: "suspended", needsReason: true, confirmText: "Suspend this account and sign it out everywhere?", successText: "Account suspended and signed out." })} className="rounded-full bg-[#9a4e25] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#7b3c1b]">Suspend</button>
                        <button disabled={busyId === account.id} onClick={() => void runAction({ action: "account_status", targetId: account.id, status: "banned", needsReason: true, confirmText: "Permanently ban this account and sign it out everywhere?", successText: "Account banned and signed out." })} className="rounded-full bg-[#521f1f] px-4 py-2 text-xs font-bold text-white transition hover:bg-black">Ban</button>
                      </>}
                      {account.provider_id && <button disabled={busyId === account.provider_id} onClick={() => void runAction({ action: "provider_status", targetId: account.provider_id!, status: account.provider_active ? "inactive" : "active", confirmText: account.provider_active ? "Pause this provider and hide all of their services?" : "Restore this provider profile?", successText: account.provider_active ? "Provider profile paused." : "Provider profile restored." })} className="rounded-full px-4 py-2 text-xs font-bold transition hover:bg-[#e5eddf]">{account.provider_active ? "Pause provider" : "Restore provider"}</button>}
                      {account.provider_id && <><span className={`rounded-full px-4 py-2 text-xs font-bold ${account.phone_verified ? "bg-[#e5f1e5] text-[#34704a]" : "bg-[#f0f1eb] text-[#718078]"}`}>{account.phone_verified ? "✓ Phone details" : "○ Phone details"}</span><span className={`rounded-full px-4 py-2 text-xs font-bold ${account.identity_verified ? "bg-[#e5f1e5] text-[#34704a]" : "bg-[#f0f1eb] text-[#718078]"}`}>{account.identity_verified ? "✓ Stripe identity" : "○ Stripe identity"}</span><span className={`rounded-full px-4 py-2 text-xs font-bold ${account.business_verified ? "bg-[#e5f1e5] text-[#34704a]" : "bg-[#f0f1eb] text-[#718078]"}`}>{account.business_verified ? "✓ Business profile" : "○ Business profile"}</span></>}
                    </div>
                  </div>
                </article>
              ))}
              {filteredAccounts.length === 0 && <EmptyState title="No matching accounts" body="Try searching with a different name, email, role, or business." />}
            </div>
          )}

          {data && section === "listings" && (
            <div className="grid gap-4 xl:grid-cols-2">
              {data.listings.map((listing) => <article key={listing.id} className="rounded-[1.7rem] border border-[#183126]/10 bg-white p-6"><div className="flex h-full flex-col"><div className="flex flex-wrap items-center gap-2"><StatusPill value={listing.is_active ? "active" : "inactive"} /><span className="text-xs font-bold uppercase tracking-wider text-[#718078]">{listing.category}</span></div><h2 className="mt-3 text-xl font-bold">{listing.title}</h2><p className="mt-1 text-sm text-[#718078]">{listing.business_name} · {listing.city}, {listing.state} · {"$" + (listing.price_cents / 100).toFixed(0)}</p><p className="mt-2 line-clamp-2 text-sm leading-6 text-[#64756c]">{listing.description}</p><p className="mt-2 text-xs text-[#8a9690]">Added {formatDate(listing.created_at)}</p><div className="mt-5 flex flex-wrap gap-2"><Link href={`/admin/listings/${listing.id}`} className="rounded-full border border-[#183126]/15 px-4 py-2 text-xs font-bold transition hover:bg-[#e5eddf]">View listing</Link><button disabled={busyId === listing.id} onClick={() => void runAction({ action: "listing_safety_scan", targetId: listing.id, successText: "Safety review completed." })} className="rounded-full bg-[#eee25a] px-4 py-2 text-xs font-bold transition hover:bg-[#e1d43d] disabled:opacity-50">{busyId === listing.id ? "Checking…" : "Run safety check"}</button><button disabled={busyId === listing.id} onClick={() => void runAction({ action: "listing_status", targetId: listing.id, status: listing.is_active ? "inactive" : "active", confirmText: listing.is_active ? "Remove this listing from the marketplace?" : "Restore this listing to the marketplace?", successText: listing.is_active ? "Listing removed." : "Listing restored." })} className={"rounded-full px-4 py-2 text-xs font-bold transition " + (listing.is_active ? "bg-[#fff0e7] text-[#9a4e25] hover:bg-[#f8d9ca]" : "bg-[#34704a] text-white hover:bg-[#285b3b]")}>{listing.is_active ? "Remove" : "Restore"}</button></div></div></article>)}
              {data.listings.length === 0 && <EmptyState title="No listings yet" body="Provider services will appear here." />}
            </div>
          )}

          {data && section === "reviews" && (
            <div className="grid gap-4 xl:grid-cols-2">
              {data.reviews.map((review) => <article key={review.id} className="rounded-[1.7rem] border border-[#183126]/10 bg-white p-6"><div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><StatusPill value={review.is_hidden ? "hidden" : "active"} /><span className="text-[#d0a51d]">{"★".repeat(review.rating)}<span className="text-[#d8ddd9]">{"★".repeat(5 - review.rating)}</span></span></div><h2 className="mt-3 font-bold">{review.customer_name}</h2><p className="mt-1 text-xs text-[#718078]">{review.customer_email} · {review.service_title}</p><p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[#52665b]">{review.body || "No written comment."}</p><p className="mt-3 text-xs text-[#8a9690]">{review.business_name} · {formatDate(review.created_at)}</p></div><button disabled={busyId === review.id} onClick={() => void runAction({ action: "review_status", targetId: review.id, status: review.is_hidden ? "visible" : "hidden", confirmText: review.is_hidden ? "Restore this review?" : "Hide this review from BubsBookings?", successText: review.is_hidden ? "Review restored." : "Review hidden." })} className={"shrink-0 rounded-full px-4 py-2 text-xs font-bold transition " + (review.is_hidden ? "bg-[#34704a] text-white hover:bg-[#285b3b]" : "bg-[#fff0e7] text-[#9a4e25] hover:bg-[#f8d9ca]")}>{review.is_hidden ? "Restore" : "Hide"}</button></div></article>)}
              {data.reviews.length === 0 && <EmptyState title="No reviews yet" body="Verified customer reviews will appear here." />}
            </div>
          )}

          {data && section === "payouts" && (
            <div className="space-y-4">
              {data.payouts.map((payout) => {
                const canFreeze = ["secured", "awaiting_customer", "failed"].includes(payout.payment_release_status);
                const frozen = payout.payment_release_status === "frozen";
                return <article key={payout.id} className="rounded-[1.7rem] border border-[#183126]/10 bg-white p-6"><div className="flex flex-col gap-4 xl:flex-row xl:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><StatusPill value={payout.payment_release_status} /><span className="text-xs font-bold uppercase tracking-wider text-[#718078]">${(payout.provider_payout_cents / 100).toFixed(2)} provider share</span></div><h2 className="mt-3 text-xl font-bold">{payout.service_title}</h2><p className="mt-1 text-sm text-[#718078]">{payout.customer_name} → {payout.provider_name}</p>{payout.completion_confirmation_due_at && payout.payment_release_status === "awaiting_customer" && <p className="mt-2 text-xs font-semibold text-[#78681f]">Automatic release after {formatDate(payout.completion_confirmation_due_at)}</p>}{payout.payout_freeze_reason && <p className="mt-2 text-xs font-semibold text-[#9a4e25]">Hold reason: {payout.payout_freeze_reason}</p>}{payout.payout_failure_reason && <p className="mt-2 text-xs font-semibold text-[#9a4e25]">Stripe error: {payout.payout_failure_reason}</p>}</div><div className="flex flex-wrap gap-2"><Link href={`/provider/dashboard/bookings/${payout.id}`} className="rounded-full border border-[#183126]/15 px-4 py-2 text-xs font-bold transition hover:bg-[#e5eddf]">View booking</Link>{payout.payment_release_status === "failed" && <button disabled={busyId === payout.id} onClick={() => void runAction({ action: "payout_retry", targetId: payout.id, confirmText: "Retry this failed Stripe payout now?", successText: "Payout released." })} className="rounded-full bg-[#183126] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#315846]">Retry payout</button>}{canFreeze && <button disabled={busyId === payout.id} onClick={() => void runAction({ action: "payout_freeze", targetId: payout.id, status: "frozen", needsReason: true, confirmText: "Freeze this payout while the booking is reviewed?", successText: "Payout frozen." })} className="rounded-full bg-[#9a4e25] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#7b3c1b]">Freeze payout</button>}{frozen && <button disabled={busyId === payout.id} onClick={() => void runAction({ action: "payout_freeze", targetId: payout.id, status: "active", confirmText: "Remove this payout hold? The payout can release automatically if its confirmation window has ended.", successText: "Payout hold removed." })} className="rounded-full bg-[#34704a] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#285b3b]">Remove hold</button>}</div></div></article>;
              })}
              {data.payouts.length === 0 && <EmptyState title="No held payments" body="Paid bookings and payout controls will appear here." />}
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
      {selectedAccount && <AccountDetailDialog account={selectedAccount} details={accountDetails} loading={accountDetailsLoading} error={accountDetailsError} onClose={closeAccount} onRetry={() => void openAccount(selectedAccount)} />}
      {pendingAction && <div className="fixed inset-0 z-[100] grid place-items-center bg-[#10251c]/55 p-5" role="dialog" aria-modal="true" aria-labelledby="admin-confirm-title"><div className="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-2xl sm:p-8"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#718078]">Confirm admin action</p><h2 id="admin-confirm-title" className="mt-2 text-2xl font-bold">Are you sure?</h2><p className="mt-3 text-sm leading-6 text-[#687970]">{pendingAction.confirmText}</p><p className="mt-4 rounded-2xl bg-[#f5f5ef] p-4 text-xs leading-5 text-[#718078]">This change is recorded in the permanent admin audit history.</p><div className="mt-6 flex justify-end gap-2"><button type="button" disabled={Boolean(busyId)} onClick={() => setPendingAction(null)} className="rounded-full px-5 py-3 text-sm font-bold transition hover:bg-[#edf1ec]">Cancel</button><button type="button" disabled={Boolean(busyId)} onClick={() => void executeAction({ ...pendingAction, confirmText: undefined })} className="rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#315846] disabled:opacity-50">{busyId ? "Saving…" : pendingAction.status === "active" || pendingAction.status === "visible" ? "Restore" : "Confirm"}</button></div></div></div>}
    </main>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="col-span-full p-10 text-center"><p className="text-3xl">✓</p><h3 className="mt-3 text-lg font-bold">{title}</h3><p className="mt-2 text-sm text-[#718078]">{body}</p></div>;
}

function show(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined || value === "") return "Not provided";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function DetailGrid({ items }: { items: Array<{ label: string; value: string | number | boolean | null | undefined }> }) {
  return <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{items.map((item) => <div key={item.label} className="rounded-2xl border border-[#183126]/10 bg-[#f8f8f4] p-4"><dt className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[#718078]">{item.label}</dt><dd className="mt-1 break-words text-sm font-semibold [overflow-wrap:anywhere]">{show(item.value)}</dd></div>)}</dl>;
}

function StripeConnectionSummary({ consumerStripe, provider }: {
  consumerStripe: AccountDetails["consumerStripe"];
  provider: AccountDetails["provider"];
}) {
  const providerConnected = Boolean(provider?.stripe_connected);
  const ready = Boolean(providerConnected && provider?.stripe_charges_enabled && provider?.stripe_payouts_enabled);
  const providerTitle = ready ? "Connected and ready" : providerConnected ? "Setup incomplete" : "Not connected";
  const providerDescription = ready
    ? "Stripe onboarding is complete. This provider can accept payments and receive payouts."
    : providerConnected
      ? "A Stripe account exists, but the provider still needs to finish Stripe onboarding before payments and payouts are fully enabled."
      : "This provider has not connected a Stripe payout account yet.";
  const providerTone = ready
    ? "border-[#34704a]/30 bg-[#e7f3e7] text-[#245c38]"
    : providerConnected
      ? "border-[#a66a1f]/30 bg-[#fff6dc] text-[#7a5711]"
      : "border-[#9a4e25]/25 bg-[#fff0e7] text-[#7b3c1b]";

  return <section className="rounded-3xl border border-[#183126]/15 bg-[#f8f8f4] p-5" aria-label="Stripe account status">
    <div><p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#718078]">Stripe status</p><h3 className="mt-1 text-lg font-bold">Payment and payout accounts</h3></div>
    <div className={`mt-4 grid gap-4 ${provider ? "lg:grid-cols-2" : ""}`}>
      <div className={`rounded-2xl border p-4 ${consumerStripe.connected ? "border-[#34704a]/30 bg-[#e7f3e7] text-[#245c38]" : "border-[#183126]/15 bg-white text-[#52665b]"}`}>
        <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-[10px] font-extrabold uppercase tracking-[.12em] opacity-75">Consumer payments</p><h4 className="mt-1 font-bold">{consumerStripe.connected ? "Stripe profile connected" : "No Stripe profile yet"}</h4></div><span className="rounded-full border border-current/20 bg-white/70 px-3 py-1 text-xs font-bold">{consumerStripe.connected ? "Connected" : "Not connected"}</span></div>
        <p className="mt-2 text-sm leading-6 opacity-90">{consumerStripe.connected ? "A Stripe Customer profile exists for this person, allowing secure customer payments. Card details remain private in Stripe." : "Stripe will create a Customer profile when this person first uses a payment feature."}</p>
        {consumerStripe.mode && <span className="mt-3 inline-flex rounded-full bg-white/70 px-3 py-1 text-xs font-bold">{consumerStripe.mode === "live" ? "Live payments" : "Test data"}</span>}
      </div>
      {provider && <div className={`rounded-2xl border p-4 ${providerTone}`}>
        <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-[10px] font-extrabold uppercase tracking-[.12em] opacity-75">Provider payouts</p><h4 className="mt-1 font-bold">{providerTitle}</h4></div><span className="rounded-full border border-current/20 bg-white/70 px-3 py-1 text-xs font-bold">{ready ? "Ready" : "Action needed"}</span></div>
        <p className="mt-2 text-sm leading-6 opacity-90">{providerDescription}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-white/70 px-3 py-1">Account: {providerConnected ? "Connected" : "Not connected"}</span><span className="rounded-full bg-white/70 px-3 py-1">Charges: {provider.stripe_charges_enabled ? "Enabled" : "Disabled"}</span><span className="rounded-full bg-white/70 px-3 py-1">Payouts: {provider.stripe_payouts_enabled ? "Enabled" : "Disabled"}</span></div>
      </div>}
    </div>
  </section>;
}

function AccountDetailDialog({ account, details, loading, error, onClose, onRetry }: {
  account: Account; details: AccountDetails | null; loading: boolean; error: string; onClose: () => void; onRetry: () => void;
}) {
  return <div className="fixed inset-0 z-[90] flex justify-end bg-[#10251c]/55" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} role="presentation">
    <section className="h-full w-full max-w-4xl overflow-y-auto bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="account-detail-title">
      <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#183126]/10 bg-white/95 px-5 py-5 backdrop-blur sm:px-8">
        <div className="flex min-w-0 items-center gap-4"><ProfileAvatar name={account.name} imageUrl={account.image} className="h-12 w-12 shrink-0 text-sm" /><div className="min-w-0"><p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#718078]">Admin account view</p><h2 id="account-detail-title" className="truncate text-2xl font-bold">{account.name}</h2><p className="truncate text-sm text-[#718078]">{account.email}</p></div></div>
        <button type="button" onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#183126]/20 text-xl transition hover:bg-[#edf1ec]" aria-label="Close account details">×</button>
      </header>
      <div className="space-y-6 p-5 sm:p-8">
        {loading && <div className="grid min-h-80 place-items-center"><div className="text-center"><div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-[#dfe8df] border-t-[#34704a]" /><p className="mt-4 text-sm font-semibold text-[#718078]">Loading permitted account information…</p></div></div>}
        {error && <div className="rounded-3xl border border-[#9a4e25]/20 bg-[#fff0e7] p-6"><h3 className="font-bold text-[#7b3c1b]">Account details unavailable</h3><p className="mt-2 text-sm text-[#9a4e25]">{error}</p><button type="button" onClick={onRetry} className="mt-4 rounded-full bg-[#183126] px-5 py-2.5 text-sm font-bold text-white">Try again</button></div>}
        {details && <>
          <div className="rounded-3xl border border-[#183126]/10 bg-[#f4f4ef] p-5"><p className="text-sm leading-6 text-[#52665b]">{details.privacyNote} Opening this view is recorded in the admin audit history.</p></div>
          <StripeConnectionSummary consumerStripe={details.consumerStripe} provider={details.provider} />
          <section><h3 className="mb-3 text-lg font-bold">Account and contact</h3><DetailGrid items={[
            { label: "Full name", value: details.account.name }, { label: "Email", value: details.account.email }, { label: "Phone", value: details.account.phone },
            { label: "Role", value: label(details.account.role) }, { label: "Email verified", value: details.account.email_verified }, { label: "Authenticator protection", value: details.account.two_factor_enabled },
            { label: "Account created", value: formatDate(details.account.created_at) }, { label: "Last updated", value: formatDate(details.account.updated_at) }, { label: "Account ID", value: details.account.id },
            { label: "Restriction", value: details.account.restriction_status ? label(details.account.restriction_status) : "None" }, { label: "Restriction reason", value: details.account.restriction_reason }, { label: "Restriction expires", value: details.account.restriction_expires_at ? formatDate(details.account.restriction_expires_at) : null },
          ]} /></section>
          <section><h3 className="mb-3 text-lg font-bold">Policy acknowledgements</h3><DetailGrid items={[
            { label: "Terms accepted", value: details.account.terms_accepted_at ? formatDate(details.account.terms_accepted_at) : null },
            { label: "Privacy acknowledged", value: details.account.privacy_acknowledged_at ? formatDate(details.account.privacy_acknowledged_at) : null },
            { label: "AI safety acknowledged", value: details.account.ai_safety_acknowledged_at ? formatDate(details.account.ai_safety_acknowledged_at) : null },
            { label: "Policy version", value: details.account.policy_version },
          ]} /></section>
          {details.settings && <section><h3 className="mb-3 text-lg font-bold">Preferences</h3><DetailGrid items={[
            { label: "Saved area", value: [details.settings.city, details.settings.state].filter(Boolean).join(", ") }, { label: "Search radius", value: `${details.settings.search_radius_miles} miles` },
            { label: "Time zone", value: details.settings.time_zone }, { label: "Theme", value: label(details.settings.theme) },
            { label: "Booking notifications", value: details.settings.booking_notifications }, { label: "Message notifications", value: details.settings.message_notifications },
          ]} /></section>}
          <section><h3 className="mb-3 text-lg font-bold">Marketplace history</h3><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">{Object.entries(details.counts).map(([key, value]) => <div key={key} className="rounded-2xl bg-[#183126] p-4 text-white"><p className="text-2xl font-bold">{value}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#bdd0c6]">{label(key)}</p></div>)}</div></section>
          {details.provider && <details open className="rounded-3xl border border-[#183126]/10 p-5"><summary className="cursor-pointer text-lg font-bold">Provider profile and billing</summary><div className="mt-4 space-y-4"><DetailGrid items={[
            { label: "Business", value: details.provider.business_name }, { label: "Provider plan", value: PLAN_ENTITLEMENTS[details.provider.plan].name }, { label: "Provider active", value: details.provider.is_active },
            { label: "Business phone", value: details.provider.phone }, { label: "Service base", value: `${details.provider.city}, ${details.provider.state}` }, { label: "Service radius", value: `${details.provider.service_radius_miles} miles` },
            { label: "Phone details checked", value: details.provider.phone_verified }, { label: "Stripe identity", value: details.provider.identity_verified }, { label: "Business profile checked", value: details.provider.business_verified },
            { label: "Safety screening", value: label(details.provider.screening_status) }, { label: "Screening score", value: details.provider.screening_score }, { label: "Screening checked", value: details.provider.screening_checked_at ? formatDate(details.provider.screening_checked_at) : null },
            { label: "Stripe connected", value: details.provider.stripe_connected }, { label: "Charges enabled", value: details.provider.stripe_charges_enabled }, { label: "Payouts enabled", value: details.provider.stripe_payouts_enabled },
            { label: "Subscription", value: label(details.provider.stripe_subscription_status) }, { label: "Current period ends", value: details.provider.stripe_current_period_end ? formatDate(details.provider.stripe_current_period_end) : null }, { label: "Live Pro trial used", value: details.provider.pro_trial_used_at_live ? formatDate(details.provider.pro_trial_used_at_live) : "No" },
            { label: "Provider agreement", value: details.provider.provider_agreement_accepted_at ? formatDate(details.provider.provider_agreement_accepted_at) : null }, { label: "Agreement version", value: details.provider.provider_agreement_version },
          ]} />{details.provider.bio && <div className="rounded-2xl bg-[#f8f8f4] p-4"><p className="text-[10px] font-extrabold uppercase tracking-wider text-[#718078]">Business description</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{details.provider.bio}</p></div>}{details.provider.screening_summary && <div className="rounded-2xl bg-[#f8f8f4] p-4"><p className="text-[10px] font-extrabold uppercase tracking-wider text-[#718078]">Screening summary</p><p className="mt-2 text-sm leading-6">{details.provider.screening_summary}</p></div>}</div></details>}
          <RecordSection title="Listings" empty="No listings on this account." records={details.services.map((service) => ({ id: service.id, title: service.title, meta: `${label(service.category)} · $${(service.price_cents / 100).toFixed(2)} · ${service.duration_minutes} min`, status: service.is_active ? "active" : "inactive", body: service.business_name }))} />
          <RecordSection title="Bookings" empty="No bookings on this account." records={details.bookings.map((booking) => ({ id: booking.id, title: booking.service_title, meta: `${booking.account_role} · ${formatDate(booking.starts_at)} · $${(booking.price_cents / 100).toFixed(2)}`, status: `${label(booking.status)} · ${label(booking.payment_status)}`, body: `Other party: ${booking.other_party_name}` }))} />
          <RecordSection title="Reviews" empty="No reviews connected to this account." records={details.reviews.map((review) => ({ id: review.id, title: `${review.relationship} · ${review.rating}/5 stars`, meta: `${review.service_title} · ${formatDate(review.created_at)}`, status: review.is_hidden ? "Hidden" : "Visible", body: review.body || "No written comment." }))} />
          <RecordSection title="Safety reports" empty="No safety reports connected to this account." records={details.reports.map((report) => ({ id: report.id, title: `${report.relationship} · ${label(report.category)}`, meta: `${report.reporter_name} → ${report.reported_name} · ${formatDate(report.created_at)}`, status: label(report.status), body: report.details || "No additional details." }))} />
          <RecordSection title="Booking disputes" empty="No disputes connected to this account." records={details.disputes.map((dispute) => ({ id: dispute.id, title: `${label(dispute.category)} · ${dispute.service_title}`, meta: `${dispute.opened_by_name} → ${dispute.against_name} · ${formatDate(dispute.created_at)}`, status: label(dispute.status), body: `${dispute.details}${dispute.requested_resolution ? `\nRequested resolution: ${dispute.requested_resolution}` : ""}${dispute.admin_note ? `\nAdmin note: ${dispute.admin_note}` : ""}` }))} />
          <RecordSection title="Support requests" empty="No support requests from this account." records={details.supportRequests.map((request) => ({ id: request.id, title: request.subject, meta: formatDate(request.created_at), status: label(request.status), body: `${request.message}${request.admin_reply ? `\nAdmin reply: ${request.admin_reply}` : ""}` }))} />
          <RecordSection title="Recent account activity" empty="No recent activity recorded." records={details.activity.map((event) => ({ id: event.id, title: label(event.action), meta: `${label(event.target_type)} · ${formatDate(event.created_at)}`, status: "Recorded", body: event.target_id ? `Record: ${event.target_id}` : "" }))} />
        </>}
      </div>
    </section>
  </div>;
}

function RecordSection({ title, empty, records }: { title: string; empty: string; records: Array<{ id: string; title: string; meta: string; status: string; body: string }> }) {
  return <details className="rounded-3xl border border-[#183126]/10 p-5"><summary className="cursor-pointer text-lg font-bold">{title} <span className="text-sm text-[#718078]">({records.length})</span></summary>{records.length === 0 ? <p className="mt-4 text-sm text-[#718078]">{empty}</p> : <div className="mt-4 divide-y divide-[#183126]/10">{records.map((record) => <article key={record.id} className="py-4 first:pt-0 last:pb-0"><div className="flex flex-wrap items-start justify-between gap-2"><div><h4 className="font-bold">{record.title}</h4><p className="mt-1 text-xs text-[#718078]">{record.meta}</p></div><span className="rounded-full bg-[#f0f1eb] px-3 py-1 text-[10px] font-bold uppercase">{record.status}</span></div>{record.body && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#52665b]">{record.body}</p>}</article>)}</div>}</details>;
}
