"use client";

import { FormEvent, useEffect, useState } from "react";

type Member = { id: string; name: string; status: "active" | "inactive" };
type Slot = { memberId: string; weekday: number; startTime: string; endTime: string };
type TimeOff = { id: string; memberId: string | null; startsAt: string; endsAt: string; reason: string };
type Day = { weekday: number; enabled: boolean; startTime: string; endTime: string };
type ScheduleRequest = { id: string; memberId: string; memberName: string; slots: Array<{ weekday: number; startTime: string; endTime: string }>; status: string; createdAt: string };

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function StaffScheduler({ members, companyName }: { members: Member[]; companyName: string }) {
  const activeMembers = members.filter((member) => member.status === "active");
  const [availability, setAvailability] = useState<Slot[]>([]);
  const [timeOff, setTimeOff] = useState<TimeOff[]>([]);
  const [isOwner, setIsOwner] = useState(true);
  const [currentMemberId, setCurrentMemberId] = useState("");
  const [scheduleRequests, setScheduleRequests] = useState<ScheduleRequest[]>([]);
  const [selectedMemberChoice, setSelectedMember] = useState("");
  const [timeOffMember, setTimeOffMember] = useState("owner");
  const [startsAt, setStartsAt] = useState(""); const [endsAt, setEndsAt] = useState(""); const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(""); const [message, setMessage] = useState(""); const [error, setError] = useState("");

  useEffect(() => { fetch(`/api/providers/team/schedule?company=${encodeURIComponent(companyName)}`, { cache: "no-store" }).then(async (response) => {
    const data = await response.json() as { availability?: Slot[]; timeOff?: TimeOff[]; isOwner?: boolean; currentMemberId?: string | null; scheduleRequests?: ScheduleRequest[]; error?: string };
    if (!response.ok) throw new Error(data.error); setAvailability(data.availability ?? []); setTimeOff(data.timeOff ?? []); setIsOwner(data.isOwner !== false); setCurrentMemberId(data.currentMemberId ?? ""); setScheduleRequests(data.scheduleRequests ?? []);
  }).catch((cause: Error) => setError(cause.message)); }, [companyName]);

  const visibleMembers = isOwner ? activeMembers : activeMembers.filter((member) => member.id === currentMemberId);
  const effectiveSelectedMember = isOwner ? selectedMemberChoice || activeMembers[0]?.id || "" : currentMemberId;
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
    const data = await response.json() as { error?: string; pendingApproval?: boolean };
    setBusy(""); if (!response.ok) { setError(data.error ?? "Hours could not be saved."); return; }
    if (!data.pendingApproval) setAvailability((current) => [...current.filter((slot) => slot.memberId !== effectiveSelectedMember), ...slots.map((slot) => ({ ...slot, memberId: effectiveSelectedMember }))]);
    setMessage(data.pendingApproval ? "Your hours were sent to the company owner for approval." : "Worker hours saved.");
  }

  async function reviewSchedule(requestId: string, decision: "approve" | "reject") {
    setBusy(requestId); setError(""); setMessage("");
    const response = await fetch("/api/providers/team/schedule", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId, decision }) });
    const data = await response.json() as { error?: string };
    setBusy(""); if (!response.ok) { setError(data.error ?? "Schedule request could not be reviewed."); return; }
    const reviewed = scheduleRequests.find((item) => item.id === requestId);
    if (decision === "approve" && reviewed) setAvailability((current) => [...current.filter((slot) => slot.memberId !== reviewed.memberId), ...reviewed.slots.map((slot) => ({ ...slot, memberId: reviewed.memberId }))]);
    setScheduleRequests((current) => current.filter((item) => item.id !== requestId));
    setMessage(decision === "approve" ? "Worker hours approved." : "Worker hours sent back for changes.");
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
    {isOwner && scheduleRequests.length > 0 && <section className="rounded-[2rem] border border-[#d4c756] bg-[#fff9d8] p-6"><p className="text-xs font-bold uppercase tracking-[.13em] text-[#74681f]">Owner approval needed</p><h2 className="mt-2 text-xl font-bold">Requested working hours</h2><div className="mt-4 space-y-3">{scheduleRequests.map((request) => <div key={request.id} className="rounded-2xl bg-white p-4"><p className="font-bold">{request.memberName}</p><p className="mt-1 text-xs text-[#718078]">{request.slots.length ? request.slots.map((slot) => `${dayNames[slot.weekday]} ${slot.startTime}–${slot.endTime}`).join(" · ") : "No working days"}</p><div className="mt-3 flex gap-2"><button disabled={busy === request.id} onClick={() => void reviewSchedule(request.id, "approve")} className="rounded-full bg-[#183126] px-4 py-2 text-xs font-bold text-white">Approve</button><button disabled={busy === request.id} onClick={() => void reviewSchedule(request.id, "reject")} className="rounded-full px-4 py-2 text-xs font-bold text-[#914e3a] hover:bg-[#f4d8cc]">Needs changes</button></div></div>)}</div></section>}
    <section className="rounded-[2rem] border border-[#183126]/10 bg-white p-6"><p className="text-xs font-bold uppercase tracking-[.13em] text-[#718078]">Individual schedules</p><h2 className="mt-2 text-xl font-bold">{isOwner ? "Worker hours" : "My working hours"}</h2><p className="mt-1 text-sm text-[#738179]">{isOwner ? "Review or set each added worker's hours." : "Submit the hours you can work. Your company owner must approve changes before customers can book them."}</p>
      {visibleMembers.length ? <>{isOwner && <label className="mt-5 block text-sm font-bold">Worker<select value={selectedMember} onChange={(event) => setSelectedMember(event.target.value)} className="mt-2 w-full max-w-md rounded-xl border border-[#183126]/15 bg-[#fafaf6] px-4 py-3">{visibleMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>}<div className="mt-5 space-y-3">{draft.map((day) => <div key={day.weekday} className={`grid gap-3 rounded-2xl border p-4 sm:grid-cols-[150px_1fr] sm:items-center ${day.enabled ? "border-[#8eaa91] bg-[#f4f8f1]" : "border-[#183126]/10 bg-[#f7f7f2]"}`}><label className="flex items-center gap-3 font-bold"><input type="checkbox" checked={day.enabled} onChange={(event) => updateDay(day.weekday, { enabled: event.target.checked })} className="h-4 w-4 accent-[#183126]" />{dayNames[day.weekday]}</label><div className="flex items-center gap-2"><input aria-label={`${dayNames[day.weekday]} start time`} disabled={!day.enabled} type="time" value={day.startTime} onChange={(event) => updateDay(day.weekday, { startTime: event.target.value })} className="min-w-0 flex-1 rounded-xl border bg-white px-3 py-2 disabled:opacity-45" /><span>to</span><input aria-label={`${dayNames[day.weekday]} end time`} disabled={!day.enabled} type="time" value={day.endTime} onChange={(event) => updateDay(day.weekday, { endTime: event.target.value })} className="min-w-0 flex-1 rounded-xl border bg-white px-3 py-2 disabled:opacity-45" /></div></div>)}</div><button onClick={() => void saveHours()} disabled={busy === "hours"} className="mt-5 rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white hover:bg-[#315846] disabled:opacity-50">{busy === "hours" ? "Saving…" : isOwner ? "Save worker hours" : "Send hours for approval"}</button></> : <p className="mt-5 rounded-2xl bg-[#f5f5ef] p-5 text-sm text-[#738179]">{isOwner ? "Add a worker above to create an individual schedule." : "Your team membership could not be loaded."}</p>}
    </section>
    <section className="rounded-[2rem] border border-[#183126]/10 bg-white p-6"><p className="text-xs font-bold uppercase tracking-[.13em] text-[#718078]">Blocked dates</p><h2 className="mt-2 text-xl font-bold">Vacations and time off</h2><form onSubmit={addTimeOff} className="mt-5 grid gap-4 md:grid-cols-2"><label className="text-sm font-bold">Staff member<select value={isOwner ? timeOffMember : currentMemberId} disabled={!isOwner} onChange={(event) => setTimeOffMember(event.target.value)} className="mt-2 w-full rounded-xl border bg-[#fafaf6] px-4 py-3"><option value="owner">Company owner</option>{visibleMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label><label className="text-sm font-bold">Reason<input required minLength={2} maxLength={200} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Vacation, appointment…" className="mt-2 w-full rounded-xl border bg-[#fafaf6] px-4 py-3" /></label><label className="text-sm font-bold">Starts<input required type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className="mt-2 w-full rounded-xl border bg-[#fafaf6] px-4 py-3" /></label><label className="text-sm font-bold">Ends<input required type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} className="mt-2 w-full rounded-xl border bg-[#fafaf6] px-4 py-3" /></label><button disabled={busy === "timeoff"} className="rounded-full bg-[#eee25a] px-5 py-3 text-sm font-bold md:col-span-2">{busy === "timeoff" ? "Adding…" : "Block this time"}</button></form>
      <div className="mt-6 divide-y divide-[#183126]/10">{timeOff.map((block) => <div key={block.id} className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center"><div><p className="font-bold">{staffName(block.memberId)} · {block.reason}</p><p className="mt-1 text-xs text-[#718078]">{new Date(block.startsAt).toLocaleString()} – {new Date(block.endsAt).toLocaleString()}</p></div><button disabled={busy === block.id} onClick={() => void removeTimeOff(block.id)} className="w-fit rounded-full px-4 py-2 text-xs font-bold text-[#914e3a] hover:bg-[#f4d8cc]">Remove</button></div>)}{!timeOff.length && <p className="py-6 text-sm text-[#738179]">No time off is currently scheduled.</p>}</div>
    </section>
  </div>;
}
