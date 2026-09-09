"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { SERVICE_AREAS, serviceAreaLabel } from "@/lib/service-areas";
import { PLAN_ENTITLEMENTS, type ProviderPlan } from "@/lib/plans";
import RadiusSelector from "@/components/radius-selector";

type Location = { id: string; companyId: string; companyName: string; name: string; location: string; serviceRadiusMiles: number; isPrimary: boolean; listingCount: number; workerIds: string[] };
type Member = { id: string; name: string; companyId: string };

export default function LocationManager() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [plan, setPlan] = useState<ProviderPlan>("starter");
  const [isOwner, setIsOwner] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("Issaquah, WA");
  const [radius, setRadius] = useState(25);
  const [workerIds, setWorkerIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch("/api/providers/locations", { cache: "no-store" });
    const data = await response.json() as { locations?: Location[]; members?: Member[]; plan?: ProviderPlan; isOwner?: boolean; error?: string };
    if (!response.ok) throw new Error(data.error ?? "Locations could not be loaded.");
    setLocations(data.locations ?? []); setMembers(data.members ?? []); setPlan(data.plan ?? "starter"); setIsOwner(data.isOwner === true);
    setCompanyId((current) => current || data.locations?.[0]?.companyId || "");
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load().catch((reason: Error) => setError(reason.message)).finally(() => setLoaded(true)); }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const companies = useMemo(() => Array.from(new Map(locations.map((item) => [item.companyId, item.companyName])).entries()), [locations]);
  const editing = locations.find((item) => item.id === editingId);

  function resetForm() {
    setEditingId(""); setName(""); setLocation("Issaquah, WA"); setRadius(25); setWorkerIds([]); setError("");
  }
  function edit(item: Location) {
    setEditingId(item.id); setCompanyId(item.companyId); setName(item.name); setLocation(item.location); setRadius(item.serviceRadiusMiles); setWorkerIds(item.workerIds); setError(""); setMessage("");
  }
  function toggleWorker(id: string) {
    setWorkerIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    const response = await fetch("/api/providers/locations", { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locationId: editingId, companyId, name, location, serviceRadiusMiles: radius, workerIds }) });
    const data = await response.json() as { error?: string };
    setBusy(false);
    if (!response.ok) { setError(data.error ?? "Location could not be saved."); return; }
    setMessage(editingId ? "Location updated." : "Location added. You can now assign listings to it."); resetForm(); await load();
  }
  async function remove(item: Location) {
    if (!window.confirm(`Remove ${item.name}?`)) return;
    setBusy(true); setError(""); setMessage("");
    const response = await fetch("/api/providers/locations", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locationId: item.id }) });
    const data = await response.json() as { error?: string }; setBusy(false);
    if (!response.ok) { setError(data.error ?? "Location could not be removed."); return; }
    setMessage("Location removed."); await load();
  }

  if (!loaded) return <section className="rounded-[2rem] border border-[#183126]/10 bg-white p-7 text-sm text-[#738179]">Loading service locations…</section>;
  if (!isOwner) return <section className="rounded-[2rem] border border-[#183126]/10 bg-white p-7"><h1 className="text-2xl font-bold">My service locations</h1><p className="mt-2 text-sm text-[#738179]">These are the locations where your company can assign you.</p><LocationCards locations={locations} onEdit={null} onRemove={null} /></section>;
  const companyMembers = members.filter((member) => member.companyId === companyId);
  const canAdd = PLAN_ENTITLEMENTS[plan].multipleLocations;
  return <div>
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold text-[#687a70]">Company operations</p><h1 className="mt-1 text-3xl font-bold tracking-[-.04em] sm:text-4xl">Service locations</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#687a70]">Create branches or service areas, assign workers, and connect each listing to the location that fulfills it.</p></div><span className="w-fit rounded-full bg-[#eee25a] px-4 py-2 text-xs font-bold">{PLAN_ENTITLEMENTS[plan].name} · {locations.length} {locations.length === 1 ? "location" : "locations"}</span></div>
    {message && <p className="mt-6 rounded-2xl bg-[#e3f1e5] px-5 py-4 text-sm font-bold text-[#34704a]">✓ {message}</p>}{error && <p className="mt-6 rounded-2xl bg-[#fff1e8] px-5 py-4 text-sm font-bold text-[#9a4e25]">{error}</p>}
    <div className="mt-7 grid gap-6 xl:grid-cols-[.85fr_1.15fr]">
      <section className="rounded-[2rem] border border-[#183126]/10 bg-white p-6"><h2 className="text-xl font-bold">{editing ? `Edit ${editing.name}` : "Add a service location"}</h2><p className="mt-1 text-sm text-[#738179]">Use a clear internal name such as “Issaquah” or “Downtown branch.”</p>
        {!canAdd && !editing ? <div className="mt-5 rounded-2xl bg-[#fff7cb] p-5"><p className="font-bold">Starter includes one location</p><p className="mt-2 text-sm leading-6 text-[#746b40]">Upgrade to Pro to add branches and additional service areas.</p><Link href="/provider/dashboard/billing" className="mt-4 inline-flex rounded-full bg-[#183126] px-4 py-2 text-xs font-bold text-white">View Pro</Link></div> : <form onSubmit={save} className="mt-5 space-y-4">
          {companies.length > 1 && !editing && <label className="block text-sm font-bold">Company<select value={companyId} onChange={(event) => { setCompanyId(event.target.value); setWorkerIds([]); }} className="mt-2 w-full rounded-2xl border border-[#183126]/15 bg-[#faf9f5] px-4 py-3 outline-none">{companies.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>}
          <label className="block text-sm font-bold">Location name<input required minLength={2} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Issaquah branch" className="mt-2 w-full rounded-2xl border border-[#183126]/15 bg-[#faf9f5] px-4 py-3 outline-none" /></label>
          <label className="block text-sm font-bold">City and state<select value={location} onChange={(event) => setLocation(event.target.value)} className="mt-2 w-full rounded-2xl border border-[#183126]/15 bg-[#faf9f5] px-4 py-3 outline-none">{SERVICE_AREAS.map((area) => { const label = serviceAreaLabel(area); return <option key={label}>{label}</option>; })}</select></label>
          <RadiusSelector value={radius} onChange={setRadius} />
          {editing && <fieldset><legend className="text-sm font-bold">Workers at this location</legend><p className="mt-1 text-xs text-[#738179]">Only assigned workers will reopen overlapping appointment times here.</p><div className="mt-3 grid gap-2">{companyMembers.length ? companyMembers.map((member) => <label key={member.id} className="flex items-center gap-3 rounded-xl bg-[#f5f5ef] px-3 py-2.5 text-sm font-semibold"><input type="checkbox" checked={workerIds.includes(member.id)} onChange={() => toggleWorker(member.id)} className="h-4 w-4 accent-[#183126]" />{member.name}</label>) : <p className="rounded-xl bg-[#f5f5ef] p-3 text-xs text-[#738179]">Add workers from the Team page, then assign them here.</p>}</div></fieldset>}
          <div className="flex gap-2"><button disabled={busy} className="flex-1 rounded-full bg-[#183126] px-5 py-3 font-bold text-white disabled:opacity-60">{busy ? "Saving…" : editing ? "Save location" : "Add location"}</button>{editing && <button type="button" onClick={resetForm} className="rounded-full border border-[#183126]/15 px-5 py-3 text-sm font-bold">Cancel</button>}</div>
        </form>}
      </section>
      <section className="rounded-[2rem] border border-[#183126]/10 bg-white p-6"><h2 className="text-xl font-bold">Your locations</h2><p className="mt-1 text-sm text-[#738179]">Listings and worker coverage are shown for each location.</p><LocationCards locations={locations} onEdit={edit} onRemove={(item) => void remove(item)} /></section>
    </div>
  </div>;
}

function LocationCards({ locations, onEdit, onRemove }: { locations: Location[]; onEdit: ((item: Location) => void) | null; onRemove: ((item: Location) => void) | null }) {
  return <div className="mt-5 space-y-3">{locations.length ? locations.map((item) => <article key={item.id} className="rounded-2xl bg-[#f5f5ef] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><p className="font-bold">{item.name}</p>{item.isPrimary && <span className="rounded-full bg-[#e3eee0] px-2 py-1 text-[10px] font-bold uppercase text-[#39704a]">Primary</span>}</div><p className="mt-1 text-sm text-[#687970]">{item.location} · Within {item.serviceRadiusMiles} mi</p><p className="mt-2 text-xs text-[#7b8982]">{item.companyName} · {item.listingCount} {item.listingCount === 1 ? "listing" : "listings"} · {item.workerIds.length} {item.workerIds.length === 1 ? "worker" : "workers"}</p></div>{onEdit && <div className="flex gap-2"><button onClick={() => onEdit(item)} className="rounded-full border border-[#183126]/15 bg-white px-3 py-2 text-xs font-bold">Edit</button>{!item.isPrimary && onRemove && <button onClick={() => onRemove(item)} className="rounded-full px-3 py-2 text-xs font-bold text-[#914e3a]">Remove</button>}</div>}</div></article>) : <p className="rounded-2xl bg-[#f5f5ef] p-5 text-sm text-[#738179]">No service locations are assigned yet.</p>}</div>;
}
