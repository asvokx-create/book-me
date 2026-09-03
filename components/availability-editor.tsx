"use client";

import { useState } from "react";

type AvailabilitySlot = { weekday: number; startTime: string; endTime: string };
type DayState = AvailabilitySlot & { enabled: boolean };

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function AvailabilityEditor({ initialSlots, onSaved }: { initialSlots: AvailabilitySlot[]; onSaved: (slots: AvailabilitySlot[]) => void }) {
  const [days, setDays] = useState<DayState[]>(() => dayNames.map((_, weekday) => {
    const saved = initialSlots.find((slot) => slot.weekday === weekday);
    return { weekday, enabled: Boolean(saved), startTime: saved?.startTime.slice(0, 5) ?? "09:00", endTime: saved?.endTime.slice(0, 5) ?? "17:00" };
  }));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function updateDay(weekday: number, changes: Partial<DayState>) {
    setDays((current) => current.map((day) => day.weekday === weekday ? { ...day, ...changes } : day));
    setMessage("");
    setError("");
  }

  async function save() {
    const slots = days.filter((day) => day.enabled).map(({ weekday, startTime, endTime }) => ({ weekday, startTime, endTime }));
    if (!slots.length) {
      setError("Select at least one working day.");
      return;
    }
    if (slots.some((slot) => slot.startTime >= slot.endTime)) {
      setError("Each start time must be earlier than its end time.");
      return;
    }

    setSaving(true);
    setError("");
    const response = await fetch("/api/providers/availability", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slots }) });
    const result = await response.json() as { error?: string };
    setSaving(false);
    if (!response.ok) {
      setError(result.error ?? "We could not save your hours.");
      return;
    }
    setMessage("Your working hours are saved.");
    onSaved(slots);
  }

  return <div className="mt-6">
    <div className="space-y-3">{days.map((day) => <div key={day.weekday} className={`grid gap-3 rounded-2xl border p-4 sm:grid-cols-[150px_1fr] sm:items-center ${day.enabled ? "border-[#8eaa91] bg-[#f4f8f1]" : "border-[#183126]/10 bg-[#f7f7f2]"}`}>
      <label className="flex items-center gap-3 text-sm font-bold"><input type="checkbox" checked={day.enabled} onChange={(event) => updateDay(day.weekday, { enabled: event.target.checked })} className="h-5 w-5 accent-[#183126]" />{dayNames[day.weekday]}</label>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2"><label><span className="sr-only">{dayNames[day.weekday]} start time</span><input type="time" value={day.startTime} disabled={!day.enabled} onChange={(event) => updateDay(day.weekday, { startTime: event.target.value })} className="w-full rounded-xl border border-[#183126]/15 bg-white px-3 py-2.5 text-sm font-semibold disabled:opacity-40" /></label><span className="text-sm text-[#718078]">to</span><label><span className="sr-only">{dayNames[day.weekday]} end time</span><input type="time" value={day.endTime} disabled={!day.enabled} onChange={(event) => updateDay(day.weekday, { endTime: event.target.value })} className="w-full rounded-xl border border-[#183126]/15 bg-white px-3 py-2.5 text-sm font-semibold disabled:opacity-40" /></label></div>
    </div>)}</div>
    <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between"><div aria-live="polite" className="text-sm font-semibold">{error && <span className="text-[#9a4c3a]">{error}</span>}{message && <span className="text-[#37724c]">✓ {message}</span>}</div><button type="button" onClick={save} disabled={saving} className="rounded-full bg-[#eee25a] px-6 py-3 text-sm font-bold shadow-sm transition hover:-translate-y-0.5 hover:bg-[#f8ed70] disabled:cursor-wait disabled:opacity-60">{saving ? "Saving…" : "Save working hours"}</button></div>
  </div>;
}
