"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { PLAN_ENTITLEMENTS, type ProviderPlan } from "@/lib/plans";
import StaffScheduler from "@/components/staff-scheduler";
import CustomSelect from "@/components/custom-select";

type Member = { id: string; name: string; email: string; role: string; companyName: string; status: "pending" | "active"; createdAt: string };

export default function TeamManager() {
  const [members, setMembers] = useState<Member[]>([]);
  const [plan, setPlan] = useState<ProviderPlan>("starter");
  const [seatLimit, setSeatLimit] = useState<number | null>(1);
  const [extraTeamSeats, setExtraTeamSeats] = useState(0);
  const [isOwner, setIsOwner] = useState(true);
  const [companyName, setCompanyName] = useState("");
  const [companies, setCompanies] = useState<string[]>([]);
  const [reservedWorkerCount, setReservedWorkerCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [role, setRole] = useState("Team member");
  const [busy, setBusy] = useState(""); const [error, setError] = useState(""); const [message, setMessage] = useState("");

  async function loadTeam(company = "") {
    const query = company ? `?company=${encodeURIComponent(company)}` : "";
    await fetch(`/api/providers/team${query}`, { cache: "no-store" }).then(async (response) => {
      const data = await response.json() as { members?: Member[]; plan?: ProviderPlan; seatLimit?: number | null; extraTeamSeats?: number; isOwner?: boolean; companyName?: string; companies?: string[]; reservedWorkerCount?: number; activeWorkerCount?: number; error?: string };
      if (!response.ok) throw new Error(data.error);
      setMembers(data.members ?? []); setPlan(data.plan ?? "starter"); setSeatLimit(data.seatLimit === undefined ? 1 : data.seatLimit);
      setExtraTeamSeats(data.extraTeamSeats ?? 0); setIsOwner(data.isOwner !== false); setCompanyName(data.companyName ?? "");
      setCompanies(data.companies ?? []); setReservedWorkerCount(data.reservedWorkerCount ?? data.activeWorkerCount ?? 0);
    }).catch((reason: Error) => setError(reason.message)).finally(() => setLoaded(true));
  }
  useEffect(() => { void loadTeam(); }, []);
  const reservedWorkers = reservedWorkerCount;
  const companyWorkers = members.length;
  const workerLimit = seatLimit === null ? null : Math.max(seatLimit - 1, 0);
  const canAdd = workerLimit === null || reservedWorkers < workerLimit;

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy("new"); setError(""); setMessage("");
    const response = await fetch("/api/providers/team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, role, companyName }) });
    const data = await response.json() as { member?: Member; reservedWorkerCount?: number; activeWorkerCount?: number; error?: string };
    setBusy(""); if (!response.ok || !data.member) { setError(data.error ?? "Worker could not be added."); return; }
    setMembers((current) => [...current.filter((item) => item.id !== data.member!.id), data.member!]); setReservedWorkerCount(data.reservedWorkerCount ?? data.activeWorkerCount ?? reservedWorkerCount); setName(""); setEmail(""); setRole("Team member"); setMessage(`${data.member.name} was invited to ${companyName}. Their invitation now reserves a seat.`);
  }
  async function updateRole(memberId: string, nextRole: string) {
    setBusy(memberId); setError(""); const response = await fetch("/api/providers/team", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memberId, role: nextRole }) }); setBusy("");
    if (!response.ok) { const data = await response.json() as { error?: string }; setError(data.error ?? "Role could not be changed."); return false; }
    const savedRole = nextRole.trim().replace(/\s+/g, " ");
    setMembers((current) => current.map((member) => member.id === memberId ? { ...member, role: savedRole } : member)); setMessage("Team role updated."); return true;
  }
  async function removeMember(member: Member) {
    if (!window.confirm(`Remove ${member.name} from your company?`)) return;
    setBusy(member.id); setError(""); const response = await fetch("/api/providers/team", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memberId: member.id }) }); const data = await response.json() as { reservedWorkerCount?: number; activeWorkerCount?: number; error?: string }; setBusy("");
    if (!response.ok) { setError(data.error ?? "Worker could not be removed."); return; }
    setMembers((current) => current.filter((item) => item.id !== member.id)); setReservedWorkerCount(data.reservedWorkerCount ?? data.activeWorkerCount ?? reservedWorkerCount); setMessage(`${member.name} was removed from ${companyName}. Their seat is now available.`);
  }

  if (!loaded) return <section className="rounded-[2rem] border border-[#183126]/10 bg-white p-7 text-sm text-[#738179]">Loading your team…</section>;
  return <div><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold text-[#687a70]">Company access</p><h1 className="mt-1 text-3xl font-bold tracking-[-.04em] sm:text-4xl">{isOwner ? "Team & seats" : companyName || "My company"}</h1><p className="mt-2 text-sm text-[#687a70]">{isOwner ? "Choose a company, then invite workers and manage its roster." : "View your company team and manage the hours you are available to work."}</p></div>{isOwner && <span className="w-fit rounded-full bg-[#eee25a] px-4 py-2 text-xs font-bold">{PLAN_ENTITLEMENTS[plan].name}</span>}</div>
    {isOwner && <section aria-label="Team seat summary" className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><SeatFact label="Included seats" value={plan === "pro" ? "3" : seatLimit === null ? "Unlimited" : String(PLAN_ENTITLEMENTS[plan].teamSeatLimit)} detail={plan === "pro" ? "Owner + 2 workers" : "Owner counts as one seat"} /><SeatFact label="Seats used" value={String(reservedWorkers + 1)} detail="Owner + active or invited workers" /><SeatFact label="Extra seats purchased" value={String(plan === "pro" ? extraTeamSeats : 0)} detail={plan === "pro" ? `$${(extraTeamSeats * 0.5).toFixed(2)}/month` : "Available on Pro"} /><SeatFact label="Total capacity" value={seatLimit === null ? "Unlimited" : String(seatLimit)} detail={seatLimit === null ? "No seat cap" : `${Math.max(seatLimit - reservedWorkers - 1, 0)} available`} /></section>}
    {isOwner && companies.length > 1 && <section className="mt-7 rounded-[2rem] border border-[#183126]/10 bg-[#e8f0e5] p-5 sm:p-6"><label className="block"><span className="text-xs font-bold uppercase tracking-[.13em] text-[#60736a]">Managing team for</span><CustomSelect ariaLabel="Managing team for" searchable={companies.length > 8} value={companyName} onChange={(value) => { setLoaded(false); setError(""); setMessage(""); void loadTeam(value); }} className="mt-2 w-full sm:max-w-md" buttonClassName="rounded-2xl border border-[#183126]/15 bg-white px-4 py-3 text-base font-bold outline-none">{companies.map((company) => <option key={company} value={company}>{company}</option>)}</CustomSelect></label><p className="mt-2 text-xs text-[#687a70]">Workers added below will only be available for listings under this company.</p></section>}
    {message && <p className="mt-6 rounded-2xl bg-[#e3f1e5] px-5 py-4 text-sm font-bold text-[#34704a]">✓ {message}</p>}{error && <p className="mt-6 rounded-2xl bg-[#fff1e8] px-5 py-4 text-sm font-bold text-[#9a4e25]">{error}</p>}
    {isOwner && <div className="mt-7 grid gap-6 xl:grid-cols-[.85fr_1.15fr]">
      <section className="rounded-[2rem] border border-[#183126]/10 bg-white p-6">
        <h2 className="text-xl font-bold">Add a worker to {companyName}</h2>
        <p className="mt-1 text-sm text-[#738179]">You use one seat as the owner. Pending invitations also reserve seats.{plan === "pro" ? " Pro includes you plus two workers; each additional worker seat is $0.50/month." : ""}</p>
        {canAdd ? <form onSubmit={addMember} className="mt-5 space-y-4"><label className="block text-sm font-bold">Full name<input required value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-2xl border border-[#183126]/15 bg-[#faf9f5] px-4 py-3 outline-none" /></label><label className="block text-sm font-bold">Work email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-2xl border border-[#183126]/15 bg-[#faf9f5] px-4 py-3 outline-none" /></label><label className="block text-sm font-bold">Role<input required minLength={2} maxLength={40} value={role} onChange={(event) => setRole(event.target.value)} placeholder="e.g. Lead detailer" className="mt-2 w-full rounded-2xl border border-[#183126]/15 bg-[#faf9f5] px-4 py-3 outline-none" /><span className="mt-2 block text-xs font-normal text-[#7a8881]">Type the person&apos;s real job title.</span></label><button disabled={busy === "new"} className="min-h-11 w-full rounded-full bg-[#183126] px-5 py-3 font-bold text-white transition hover:bg-[#315846] disabled:opacity-60">{busy === "new" ? "Sending invitation…" : "Invite worker"}</button></form> : <div className="mt-5 rounded-2xl bg-[#fff7cb] p-5"><p className="font-bold">{plan === "pro" ? "You’ve used all available team seats" : "Team members require Pro"}</p><p className="mt-2 text-sm leading-6 text-[#746b40]">{plan === "starter" ? "Starter includes the owner only. Upgrade to Pro to add team members." : `Your owner account, active workers, and pending invitations use all ${seatLimit} seats. Add another seat for $0.50/month.`}</p><Link href="/provider/dashboard/billing" className="mt-4 inline-flex min-h-11 items-center rounded-full bg-[#183126] px-4 py-2 text-xs font-bold text-white">{plan === "pro" ? "Add a team seat" : "Upgrade to Pro"}</Link></div>}
      </section>
      <section className="rounded-[2rem] border border-[#183126]/10 bg-white p-6"><div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-bold">{companyName} roster</h2><p className="mt-1 text-sm text-[#738179]">Pending invitations reserve a seat until removed or accepted.</p></div><span className="shrink-0 rounded-full bg-[#edf2e8] px-3 py-1.5 text-xs font-bold">{companyWorkers} workers</span></div><div className="mt-5 space-y-3"><div className="flex items-center gap-4 rounded-2xl bg-[#183126] p-4 text-white"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/15 font-bold">You</span><div className="min-w-0 flex-1"><p className="font-bold">Company owner</p><p className="text-xs text-[#b8c7bf]">Full account access · uses 1 seat</p></div><span className="rounded-full bg-[#eee25a] px-3 py-1 text-xs font-bold text-[#183126]">Owner</span></div>{members.map((member) => <div key={member.id} className="flex flex-col gap-3 rounded-2xl bg-[#f5f5ef] p-4 sm:flex-row sm:items-center"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#dfe9da] font-bold">{member.name.split(/\s+/).slice(0,2).map((part) => part[0]).join("").toUpperCase()}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-bold">{member.name}</p>{member.status === "pending" && <span className="rounded-full bg-[#fff1a8] px-2 py-1 text-[10px] font-bold text-[#665500]">Invite pending</span>}</div><p className="truncate text-xs text-[#738179]">{member.email}</p></div><RoleEditor member={member} busy={busy === member.id} onSave={updateRole} /><button disabled={busy === member.id} onClick={() => void removeMember(member)} className="min-h-11 rounded-full px-3 py-2 text-xs font-bold text-[#914e3a] transition hover:bg-[#f4d8cc]">Remove</button></div>)}</div></section>
    </div>}
    {!isOwner && <section className="mt-7 rounded-[2rem] border border-[#183126]/10 bg-white p-6"><h2 className="text-xl font-bold">Company roster</h2><p className="mt-1 text-sm text-[#738179]">Only the owner can add, remove, or edit workers.</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{members.map((member) => <div key={member.id} className="rounded-2xl bg-[#f5f5ef] p-4"><p className="font-bold">{member.name}</p><p className="mt-1 text-xs text-[#738179]">{member.role}</p></div>)}</div></section>}
    <StaffScheduler key={companyName} members={members.filter((member) => member.status === "active")} companyName={companyName} />
  </div>;
}

function SeatFact({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-2xl border border-[#183126]/10 bg-white p-5"><p className="text-xs font-bold uppercase tracking-[.1em] text-[#718078]">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p><p className="mt-1 text-xs leading-5 text-[#718078]">{detail}</p></div>;
}

function RoleEditor({ member, busy, onSave }: { member: Member; busy: boolean; onSave: (memberId: string, role: string) => Promise<boolean> }) {
  const [value, setValue] = useState(member.role);

  async function save() {
    const nextRole = value.trim().replace(/\s+/g, " ");
    if (nextRole === member.role) return;
    if (nextRole.length < 2 || nextRole.length > 40) { setValue(member.role); return; }
    if (!await onSave(member.id, nextRole)) setValue(member.role);
  }

  return <input aria-label={`Role for ${member.name}`} disabled={busy} minLength={2} maxLength={40} value={value} onChange={(event) => setValue(event.target.value)} onBlur={() => void save()} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} className="w-full rounded-full border border-[#183126]/10 bg-white px-3 py-2 text-xs font-bold outline-none transition focus:border-[#4d725d] sm:w-40" />;
}
