"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { PLAN_ENTITLEMENTS, type ProviderPlan } from "@/lib/plans";
import StaffScheduler from "@/components/staff-scheduler";

type Member = { id: string; name: string; email: string; role: string; status: "active" | "inactive"; createdAt: string };

export default function TeamManager() {
  const [members, setMembers] = useState<Member[]>([]);
  const [plan, setPlan] = useState<ProviderPlan>("starter");
  const [seatLimit, setSeatLimit] = useState<number | null>(1);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [role, setRole] = useState("Team member");
  const [busy, setBusy] = useState(""); const [error, setError] = useState(""); const [message, setMessage] = useState("");

  useEffect(() => { fetch("/api/providers/team", { cache: "no-store" }).then(async (response) => { const data = await response.json() as { members?: Member[]; plan?: ProviderPlan; seatLimit?: number | null; error?: string }; if (!response.ok) throw new Error(data.error); setMembers(data.members ?? []); setPlan(data.plan ?? "starter"); setSeatLimit(data.seatLimit === undefined ? 1 : data.seatLimit); }).catch((reason: Error) => setError(reason.message)).finally(() => setLoaded(true)); }, []);
  const activeWorkers = members.filter((member) => member.status === "active").length;
  const workerLimit = seatLimit === null ? null : Math.max(seatLimit - 1, 0);
  const canAdd = workerLimit === null || activeWorkers < workerLimit;

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy("new"); setError(""); setMessage("");
    const response = await fetch("/api/providers/team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, role }) });
    const data = await response.json() as { member?: Member; error?: string };
    setBusy(""); if (!response.ok || !data.member) { setError(data.error ?? "Worker could not be added."); return; }
    setMembers((current) => [...current.filter((item) => item.id !== data.member!.id), data.member!]); setName(""); setEmail(""); setRole("Team member"); setMessage(`${data.member.name} was added to your team.`);
  }
  async function updateRole(memberId: string, nextRole: string) {
    setBusy(memberId); setError(""); const response = await fetch("/api/providers/team", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memberId, role: nextRole }) }); setBusy("");
    if (!response.ok) { const data = await response.json() as { error?: string }; setError(data.error ?? "Role could not be changed."); return false; }
    const savedRole = nextRole.trim().replace(/\s+/g, " ");
    setMembers((current) => current.map((member) => member.id === memberId ? { ...member, role: savedRole } : member)); setMessage("Team role updated."); return true;
  }
  async function removeMember(member: Member) {
    if (!window.confirm(`Remove ${member.name} from your company?`)) return;
    setBusy(member.id); setError(""); const response = await fetch("/api/providers/team", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memberId: member.id }) }); setBusy("");
    if (!response.ok) { const data = await response.json() as { error?: string }; setError(data.error ?? "Worker could not be removed."); return; }
    setMembers((current) => current.filter((item) => item.id !== member.id)); setMessage(`${member.name} was removed.`);
  }

  if (!loaded) return <section className="rounded-[2rem] border border-[#183126]/10 bg-white p-7 text-sm text-[#738179]">Loading your team…</section>;
  return <div><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold text-[#687a70]">Company access</p><h1 className="mt-1 text-3xl font-bold tracking-[-.04em] sm:text-4xl">Team</h1><p className="mt-2 text-sm text-[#687a70]">Add workers and decide who can help manage the company.</p></div><span className="w-fit rounded-full bg-[#eee25a] px-4 py-2 text-xs font-bold">{PLAN_ENTITLEMENTS[plan].name} · {seatLimit === null ? "Unlimited seats" : `${activeWorkers + 1}/${seatLimit} seats`}</span></div>
    {message && <p className="mt-6 rounded-2xl bg-[#e3f1e5] px-5 py-4 text-sm font-bold text-[#34704a]">✓ {message}</p>}{error && <p className="mt-6 rounded-2xl bg-[#fff1e8] px-5 py-4 text-sm font-bold text-[#9a4e25]">{error}</p>}
    <div className="mt-7 grid gap-6 xl:grid-cols-[.85fr_1.15fr]">
      <section className="rounded-[2rem] border border-[#183126]/10 bg-white p-6"><h2 className="text-xl font-bold">Add a worker</h2><p className="mt-1 text-sm text-[#738179]">Seats include you as the company owner.</p>{canAdd ? <form onSubmit={addMember} className="mt-5 space-y-4"><label className="block text-sm font-bold">Full name<input required value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-2xl border border-[#183126]/15 bg-[#faf9f5] px-4 py-3 outline-none" /></label><label className="block text-sm font-bold">Work email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-2xl border border-[#183126]/15 bg-[#faf9f5] px-4 py-3 outline-none" /></label><label className="block text-sm font-bold">Role<input required minLength={2} maxLength={40} value={role} onChange={(event) => setRole(event.target.value)} placeholder="e.g. Lead detailer" className="mt-2 w-full rounded-2xl border border-[#183126]/15 bg-[#faf9f5] px-4 py-3 outline-none" /><span className="mt-2 block text-xs font-normal text-[#7a8881]">Type the person&apos;s real job title.</span></label><button disabled={busy === "new"} className="w-full rounded-full bg-[#183126] px-5 py-3 font-bold text-white transition hover:bg-[#315846] disabled:opacity-60">{busy === "new" ? "Adding…" : "Add worker"}</button></form> : <div className="mt-5 rounded-2xl bg-[#fff7cb] p-5"><p className="font-bold">Your team seats are full</p><p className="mt-2 text-sm leading-6 text-[#746b40]">{plan === "starter" ? "Starter includes the owner only. Pro includes three total team seats." : "Upgrade your plan to add more workers."}</p><Link href="/provider/dashboard/billing" className="mt-4 inline-flex rounded-full bg-[#183126] px-4 py-2 text-xs font-bold text-white">View plan options</Link></div>}</section>
      <section className="rounded-[2rem] border border-[#183126]/10 bg-white p-6"><div className="flex items-center justify-between"><div><h2 className="text-xl font-bold">Company roster</h2><p className="mt-1 text-sm text-[#738179]">You are the owner. Added workers appear below.</p></div><span className="rounded-full bg-[#edf2e8] px-3 py-1.5 text-xs font-bold">{activeWorkers} workers</span></div><div className="mt-5 space-y-3"><div className="flex items-center gap-4 rounded-2xl bg-[#183126] p-4 text-white"><span className="grid h-11 w-11 place-items-center rounded-full bg-white/15 font-bold">You</span><div className="flex-1"><p className="font-bold">Company owner</p><p className="text-xs text-[#b8c7bf]">Full account access</p></div><span className="rounded-full bg-[#eee25a] px-3 py-1 text-xs font-bold text-[#183126]">Owner</span></div>{members.map((member) => <div key={member.id} className="flex flex-col gap-3 rounded-2xl bg-[#f5f5ef] p-4 sm:flex-row sm:items-center"><span className="grid h-11 w-11 place-items-center rounded-full bg-[#dfe9da] font-bold">{member.name.split(/\s+/).slice(0,2).map((part) => part[0]).join("").toUpperCase()}</span><div className="min-w-0 flex-1"><p className="font-bold">{member.name}</p><p className="truncate text-xs text-[#738179]">{member.email}</p></div><RoleEditor member={member} busy={busy === member.id} onSave={updateRole} /><button disabled={busy === member.id} onClick={() => void removeMember(member)} className="rounded-full px-3 py-2 text-xs font-bold text-[#914e3a] transition hover:bg-[#f4d8cc]">Remove</button></div>)}</div></section>
    </div>
    <StaffScheduler members={members} />
  </div>;
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
