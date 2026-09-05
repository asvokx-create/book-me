"use client";

import { FormEvent, useEffect, useState } from "react";

type Member = { id: string; name: string; status: "active" | "inactive" };
type Slot = { memberId: string; weekday: number; startTime: string; endTime: string };
type TimeOff = { id: string; memberId: string | null; startsAt: string; endsAt: string; reason: string };
type Day = { weekday: number; enabled: boolean; startTime: string; endTime: string };

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function StaffScheduler({ members }: { members: Member[] }) {
  const activeMembers = members.filter((member) => member.status === "active");
  const [availability, setAvailability] = useState<Slot[]>([]);
  const [timeOff, setTimeOff] = useState<TimeOff[]>([]);
  const [selectedMemberChoice, setSelectedMember] = useState("");
  const [timeOffMember, setTimeOffMember] = useState("owner");
  const [startsAt, setStartsAt] = useState(""); const [endsAt, setEndsAt] = useState(""); const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(""); const [message, setMessage] = useState(""); const [error, setError] = useState("");

  useEffect(() => { fetch("/api/providers/team/schedule", { cache: "no-store" }).then(async (response) => {
    const data = await response.json() as { availability?: Slot[]; timeOff?: TimeOff[]; error?: string };
    if (!response.ok) throw new Error(data.error); setAvailability(data.availability ?? []); setTimeOff(data.timeOff ?? []);
  }).catch((cause: Error) => setError(cause.message)); }, []);

  const effectiveSelectedMember = selectedMemberChoice || activeMembers[0]?.id || "";
  const selectedMember = effectiveSelectedMember;

  const [draft, setDraft] = useState<Day[]>(() => dayNames.map((_, weekday) => ({ weekday, enabled: false, startTime: "09:00", endTime: "17:00" })));
  useEffect(() => { const timer = window.setTimeout(() => setDraft(dayNames.map((_, weekday) => {
    const slot = availability.find((item) => item.memberId === effectiveSelectedMember && item.weekday === weekday);
    return { weekday, enabled: Boolean(slot), startTime: slot?.startTime ?? "09:00", endTime: slot?.endTime ?? "17:00" };
  })), 0); return () => window.clearTimeout(timer); }, [availability, effectiveSelectedMember]);
  function updateDay(weekday: number, changes: Partial<Day>) { setDraft((current) => current.map((day) => day.weekday === weekday ? { ...day, ...changes } : day)); }

  async function saveHours() {
    if (!effectiveSelectedMember) return;
    setBusy("hours"); setError(""); setMessage("");
    const slots = draft.filter((day) => day.enabled).map(({ weekday, startTime, endTime }) => ({ weekday, startTime, endTime }));
    const response = await fetch("/api/providers/team/schedule", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memberId: effectiveSelectedMember, slots }) });
    const data = await response.json() as { error?: string };
    setBusy(""); if (!response.ok) { setError(data.error ?? "Hours could not be saved."); return; }
    setAvailability((current) => [...current.filter((slot) => slot.memberId !== effectiveSelectedMember), ...slots.map((slot) => ({ ...slot, memberId: effectiveSelectedMember }))]);
    setMessage("Worker hours saved.");
  }

  async function addTimeOff(event: FormEvent) {
    event.preventDefault(); setBusy("timeoff"); setError(""); setMessage("");
    const response = await fetch("/api/providers/team/schedule", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: timeOffMember, startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString(), reason }) });
    const data = await response.json() as { block?: TimeOff; error?: string };
    setBusy(""); if (!response.ok || !data.block) { setError(data.error ?? "Time off could not be saved."); return; }
    setTimeOff((current) => [...current, data.block!].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
    setStartsAt(""); setEndsAt(""); setReason(""); setMessage("Time off added to the schedule.");
  }
  async function removeTimeOff(id: string) {
    if (!window.confirm("Remove this time-off block?")) return;
    setBusy(id); const response = await fetch("/api/providers/team/schedule", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }); setBusy("");
    if (!response.ok) { const data = await response.json() as { error?: string }; setError(data.error ?? "Time off could not be removed."); return; }
    setTimeOff((current) => current.filter((block) => block.id !== id)); setMessage("Time off removed.");
  }
  const staffName = (memberId: string | null) => memberId ? activeMembers.find((member) => member.id === memberId)?.name ?? "Former worker" : "Company owner";

  return <div className="mt-7 space-y-6">
    {message && <p className="rounded-2xl bg-[#e3f1e5] px-5 py-4 text-sm font-bold text-[#34704a]">✓ {message}</p>}{error && <p className="rounded-2xl bg-[#fff1e8] px-5 py-4 text-sm font-bold text-[#9a4e25]">{error}</p>}
    <section className="rounded-[2rem] border border-[#183126]/10 bg-white p-6"><p className="text-xs font-bold uppercase tracking-[.13em] text-[#718078]">Individual schedules</p><h2 className="mt-2 text-xl font-bold">Worker hours</h2><p className="mt-1 text-sm text-[#738179]">The company owner uses the main Availability page. Set each added worker&apos;s hours here.</p>
      {activeMembers.length ? <><label className="mt-5 block text-sm font-bold">Worker<select value={selectedMember} onChange={(event) => setSelectedMember(event.target.value)} className="mt-2 w-full max-w-md rounded-xl border border-[#183126]/15 bg-[#fafaf6] px-4 py-3">{activeMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label><div className="mt-5 space-y-3">{draft.map((day) => <div key={day.weekday} className={`grid gap-3 rounded-2xl border p-4 sm:grid-cols-[150px_1fr] sm:items-center ${day.enabled ? "border-[#8eaa91] bg-[#f4f8f1]" : "border-[#183126]/10 bg-[#f7f7f2]"}`}><label className="flex items-center gap-3 font-bold"><input type="checkbox" checked={day.enabled} onChange={(event) => updateDay(day.weekday, { enabled: event.target.checked })} className="h-4 w-4 accent-[#183126]" />{dayNames[day.weekday]}</label><div className="flex items-center gap-2"><input aria-label={`${dayNames[day.weekday]} start time`} disabled={!day.enabled} type="time" value={day.startTime} onChange={(event) => updateDay(day.weekday, { startTime: event.target.value })} className="min-w-0 flex-1 rounded-xl border bg-white px-3 py-2 disabled:opacity-45" /><span>to</span><input aria-label={`${dayNames[day.weekday]} end time`} disabled={!day.enabled} type="time" value={day.endTime} onChange={(event) => updateDay(day.weekday, { endTime: event.target.value })} className="min-w-0 flex-1 rounded-xl border bg-white px-3 py-2 disabled:opacity-45" /></div></div>)}</div><button onClick={() => void saveHours()} disabled={busy === "hours"} className="mt-5 rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white hover:bg-[#315846] disabled:opacity-50">{busy === "hours" ? "Saving…" : "Save worker hours"}</button></> : <p className="mt-5 rounded-2xl bg-[#f5f5ef] p-5 text-sm text-[#738179]">Add a worker above to create an individual schedule.</p>}
    </section>
    <section className="rounded-[2rem] border border-[#183126]/10 bg-white p-6"><p className="text-xs font-bold uppercase tracking-[.13em] text-[#718078]">Blocked dates</p><h2 className="mt-2 text-xl font-bold">Vacations and time off</h2><form onSubmit={addTimeOff} className="mt-5 grid gap-4 md:grid-cols-2"><label className="text-sm font-bold">Staff member<select value={timeOffMember} onChange={(event) => setTimeOffMember(event.target.value)} className="mt-2 w-full rounded-xl border bg-[#fafaf6] px-4 py-3"><option value="owner">Company owner</option>{activeMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label><label className="text-sm font-bold">Reason<input required minLength={2} maxLength={200} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Vacation, appointment…" className="mt-2 w-full rounded-xl border bg-[#fafaf6] px-4 py-3" /></label><label className="text-sm font-bold">Starts<input required type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className="mt-2 w-full rounded-xl border bg-[#fafaf6] px-4 py-3" /></label><label className="text-sm font-bold">Ends<input required type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} className="mt-2 w-full rounded-xl border bg-[#fafaf6] px-4 py-3" /></label><button disabled={busy === "timeoff"} className="rounded-full bg-[#eee25a] px-5 py-3 text-sm font-bold md:col-span-2">{busy === "timeoff" ? "Adding…" : "Block this time"}</button></form>
      <div className="mt-6 divide-y divide-[#183126]/10">{timeOff.map((block) => <div key={block.id} className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center"><div><p className="font-bold">{staffName(block.memberId)} · {block.reason}</p><p className="mt-1 text-xs text-[#718078]">{new Date(block.startsAt).toLocaleString()} – {new Date(block.endsAt).toLocaleString()}</p></div><button disabled={busy === block.id} onClick={() => void removeTimeOff(block.id)} className="w-fit rounded-full px-4 py-2 text-xs font-bold text-[#914e3a] hover:bg-[#f4d8cc]">Remove</button></div>)}{!timeOff.length && <p className="py-6 text-sm text-[#738179]">No time off is currently scheduled.</p>}</div>
    </section>
  </div>;
}
