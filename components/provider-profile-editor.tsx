"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import ListingShareButton from "@/components/listing-share-button";
import UiIcon from "@/components/ui-icon";
import CustomSelect from "@/components/custom-select";
import { PROVIDER_PROFILE_LIMITS } from "@/lib/provider-profile-options";

type PortfolioItem = { id: string; url: string; caption: string; alt_text: string; service_id: string | null; service_title?: string | null; moderation_status: "active" | "hidden" };
type Profile = { publicSlug: string; visible: boolean; businessName: string; about: string; yearsExperience: number | null; experienceSummary: string; specialties: string[]; languages: string[]; highlights: string[]; profileImageUrl: string; portfolio: PortfolioItem[]; services: Array<{ id: string; title: string }>; options: { languages: string[]; highlights: string[] } };

export default function ProviderProfileEditor() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  async function load() {
    const response = await fetch("/api/providers/profile");
    const data = await response.json().catch(() => ({}));
    if (!response.ok) setError(data.error || "Could not load your public profile."); else setProfile(data);
    setLoading(false);
  }
  useEffect(() => {
    let active = true;
    fetch("/api/providers/profile").then(async (response) => ({ response, data: await response.json().catch(() => ({})) })).then(({ response, data }) => {
      if (!active) return;
      if (!response.ok) setError(data.error || "Could not load your public profile."); else setProfile(data as Profile);
      setLoading(false);
    }).catch(() => { if (active) { setError("Could not load your public profile."); setLoading(false); } });
    return () => { active = false; };
  }, []);
  const completion = useMemo(() => profile ? [Boolean(profile.profileImageUrl), profile.about.length >= 80, profile.specialties.length > 0, profile.languages.length > 0, profile.portfolio.length > 0].filter(Boolean).length : 0, [profile]);

  async function save(event: FormEvent) {
    event.preventDefault(); if (!profile) return;
    setSaving(true); setError(""); setMessage("");
    const response = await fetch("/api/providers/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) setError(data.error || "Could not save your profile."); else setMessage("Public profile saved.");
    setSaving(false);
  }

  function toggle(key: "languages" | "highlights", value: string) {
    if (!profile) return;
    const values = profile[key];
    setProfile({ ...profile, [key]: values.includes(value) ? values.filter((item) => item !== value) : [...values, value] });
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!profile) return;
    const formElement = event.currentTarget;
    setUploading(true); setError("");
    const form = new FormData(formElement);
    const response = await fetch("/api/providers/profile/portfolio", { method: "POST", body: form });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) setError(data.error || "Could not upload that image."); else { await load(); formElement.reset(); setMessage("Portfolio image added."); }
    setUploading(false);
  }

  async function remove(id: string) {
    if (!profile) return;
    const response = await fetch("/api/providers/profile/portfolio", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    if (response.ok) setProfile({ ...profile, portfolio: profile.portfolio.filter((item) => item.id !== id) }); else setError((await response.json().catch(() => ({}))).error || "Could not remove that image.");
  }

  async function move(index: number, direction: -1 | 1) {
    if (!profile) return;
    const nextIndex = index + direction; if (nextIndex < 0 || nextIndex >= profile.portfolio.length) return;
    const items = [...profile.portfolio]; [items[index], items[nextIndex]] = [items[nextIndex], items[index]];
    setProfile({ ...profile, portfolio: items });
    const response = await fetch("/api/providers/profile/portfolio", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderedIds: items.map((item) => item.id) }) });
    if (!response.ok) { setError("Could not reorder the portfolio."); await load(); }
  }

  if (loading) return <section className="rounded-[2rem] border border-[#183126]/10 bg-white p-7 text-sm text-[#718078]">Loading your public profile…</section>;
  if (!profile) return <section className="rounded-[2rem] border border-[#b56850]/30 bg-[#fff3ee] p-7"><h1 className="text-xl font-bold">Public profile unavailable</h1><p className="mt-2 text-sm">{error}</p></section>;

  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold text-[#687a70]">Your public presence</p><h1 className="mt-1 text-3xl font-bold tracking-[-.04em] sm:text-4xl">Public provider profile</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#687a70]">Help customers understand your business before they message or book.</p></div><div className="flex flex-wrap gap-2"><ListingShareButton providerSlug={profile.publicSlug} title={profile.businessName} /><Link href={`/providers/${profile.publicSlug}?preview=owner`} target="_blank" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#183126] px-5 py-2.5 text-sm font-bold text-white">View my page<UiIcon name="external-link" className="h-4 w-4" /></Link></div></div>
    <section className="rounded-[2rem] border border-[#183126]/10 bg-white p-6 sm:p-8"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Profile checklist</h2><p className="mt-1 text-sm text-[#718078]">Optional guidance—not a ranking score.</p></div><span className="rounded-full bg-[#edf2e9] px-4 py-2 text-sm font-bold">{completion} of 5 added</span></div><ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-5">{[[profile.profileImageUrl, "Profile image"], [profile.about.length >= 80, "About details"], [profile.specialties.length, "Specialties"], [profile.languages.length, "Languages"], [profile.portfolio.length, "Portfolio work"]].map(([done, label]) => <li key={String(label)} className="rounded-xl bg-[#f5f5ef] p-3"><span aria-hidden="true">{done ? "✓" : "○"}</span> {label}</li>)}</ul></section>
    <form onSubmit={save} className="rounded-[2rem] border border-[#183126]/10 bg-white p-6 sm:p-8"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold">Profile details</h2><p className="mt-1 text-sm text-[#718078]">Your name and profile image come from your account settings.</p></div><Link href="/account/settings" className="text-sm font-bold underline decoration-[#c7bb41] decoration-2 underline-offset-4">Manage profile image</Link></div>
      <label className="mt-6 block"><span className="font-bold">About your business</span><textarea value={profile.about} maxLength={PROVIDER_PROFILE_LIMITS.about} onChange={(event) => setProfile({ ...profile, about: event.target.value })} rows={6} className="mt-2 w-full rounded-2xl border border-[#183126]/15 bg-white px-4 py-3 outline-none focus:border-[#557463] focus:ring-4 focus:ring-[#557463]/15" /><span className="mt-1 block text-right text-xs text-[#718078]">{profile.about.length}/{PROVIDER_PROFILE_LIMITS.about}</span></label>
      <div className="mt-5 grid gap-4 sm:grid-cols-[12rem_1fr]"><label><span className="font-bold">Years of experience</span><input type="number" min="0" max="80" value={profile.yearsExperience ?? ""} onChange={(event) => setProfile({ ...profile, yearsExperience: event.target.value === "" ? null : Number(event.target.value) })} className="mt-2 w-full rounded-xl border border-[#183126]/15 px-4 py-3" /></label><label><span className="font-bold">Experience summary</span><textarea value={profile.experienceSummary} maxLength={PROVIDER_PROFILE_LIMITS.experience} onChange={(event) => setProfile({ ...profile, experienceSummary: event.target.value })} rows={3} className="mt-2 w-full rounded-xl border border-[#183126]/15 px-4 py-3" /></label></div>
      <label className="mt-5 block"><span className="font-bold">Specialties</span><span className="ml-2 text-xs text-[#718078]">Separate with commas, up to {PROVIDER_PROFILE_LIMITS.specialties}</span><input value={profile.specialties.join(", ")} onChange={(event) => setProfile({ ...profile, specialties: event.target.value.split(",").map((item) => item.trim()).filter(Boolean).slice(0, PROVIDER_PROFILE_LIMITS.specialties) })} placeholder="Interior detailing, paint correction" className="mt-2 w-full rounded-xl border border-[#183126]/15 px-4 py-3" /></label>
      <ChoiceGroup title="Languages" values={profile.options.languages} selected={profile.languages} onToggle={(value) => toggle("languages", value)} />
      <ChoiceGroup title="Business highlights" values={profile.options.highlights} selected={profile.highlights} onToggle={(value) => toggle("highlights", value)} />
      <label className="mt-6 flex items-start gap-3 rounded-2xl bg-[#f5f5ef] p-4"><input type="checkbox" checked={profile.visible} onChange={(event) => setProfile({ ...profile, visible: event.target.checked })} className="mt-1 h-5 w-5" /><span><strong className="block">Show my public profile</strong><span className="text-sm text-[#718078]">Turning this off removes the profile from public pages and search engines. Your service listings remain managed separately.</span></span></label>
      <div className="mt-6 flex flex-wrap items-center gap-3"><button disabled={saving} className="min-h-12 rounded-full bg-[#eee25a] px-7 py-3 font-bold disabled:opacity-60">{saving ? "Saving…" : "Save profile"}</button>{message && <p role="status" className="text-sm font-bold text-[#35704a]">{message}</p>}{error && <p role="alert" className="text-sm font-bold text-[#a04f38]">{error}</p>}</div>
    </form>
    <section className="rounded-[2rem] border border-[#183126]/10 bg-white p-6 sm:p-8"><h2 className="text-xl font-bold">Portfolio</h2><p className="mt-1 text-sm text-[#718078]">Add up to {PROVIDER_PROFILE_LIMITS.portfolio} work photos. These are separate from listing photos.</p>
      {profile.portfolio.length > 0 && <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{profile.portfolio.map((item, index) => <article key={item.id} className="overflow-hidden rounded-2xl border border-[#183126]/10"><Image src={item.url} alt={item.alt_text || item.caption || "Portfolio image"} width={600} height={450} unoptimized className="aspect-[4/3] w-full object-cover" /><div className="p-4"><p className="text-sm font-bold">{item.caption || "Untitled work"}</p>{item.moderation_status === "hidden" && <p className="mt-1 text-xs font-bold text-[#a04f38]">Hidden by an administrator</p>}<div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={index === 0} onClick={() => move(index, -1)} className="rounded-full border px-3 py-2 text-xs font-bold disabled:opacity-40" aria-label={`Move ${item.caption || "image"} earlier`}>← Earlier</button><button type="button" disabled={index === profile.portfolio.length - 1} onClick={() => move(index, 1)} className="rounded-full border px-3 py-2 text-xs font-bold disabled:opacity-40" aria-label={`Move ${item.caption || "image"} later`}>Later →</button><button type="button" onClick={() => remove(item.id)} className="rounded-full border border-[#a04f38]/30 px-3 py-2 text-xs font-bold text-[#a04f38]">Remove</button></div></div></article>)}</div>}
      <form onSubmit={upload} className="mt-6 grid gap-3 rounded-2xl bg-[#f5f5ef] p-5 md:grid-cols-2"><label className="font-bold">Work photo<input name="image" type="file" accept="image/jpeg,image/png,image/webp" required className="mt-2 block w-full text-sm" /></label><label className="font-bold">Related service<CustomSelect ariaLabel="Related service" searchable={profile.services.length > 8} name="serviceId" className="mt-2" buttonClassName="w-full rounded-xl border border-[#183126]/15 bg-white px-4 py-3"><option value="">No specific service</option>{profile.services.map((service) => <option key={service.id} value={service.id}>{service.title}</option>)}</CustomSelect></label><label className="font-bold">Caption<input name="caption" maxLength={PROVIDER_PROFILE_LIMITS.caption} className="mt-2 w-full rounded-xl border border-[#183126]/15 bg-white px-4 py-3" /></label><label className="font-bold">Image description <span className="font-normal text-[#718078]">(for accessibility)</span><input name="altText" maxLength={PROVIDER_PROFILE_LIMITS.altText} className="mt-2 w-full rounded-xl border border-[#183126]/15 bg-white px-4 py-3" /></label><button disabled={uploading || profile.portfolio.length >= PROVIDER_PROFILE_LIMITS.portfolio} className="min-h-11 rounded-full bg-[#183126] px-6 py-3 text-sm font-bold text-white disabled:opacity-50 md:w-fit">{uploading ? "Uploading…" : "Add to portfolio"}</button></form>
    </section>
  </div>;
}

function ChoiceGroup({ title, values, selected, onToggle }: { title: string; values: string[]; selected: string[]; onToggle: (value: string) => void }) {
  return <fieldset className="mt-5"><legend className="font-bold">{title}</legend><div className="mt-3 flex flex-wrap gap-2">{values.map((value) => <label key={value} className={`cursor-pointer rounded-full border px-4 py-2 text-sm font-semibold ${selected.includes(value) ? "border-[#456653] bg-[#e5eddf]" : "border-[#183126]/15 bg-white"}`}><input type="checkbox" checked={selected.includes(value)} onChange={() => onToggle(value)} className="sr-only" />{value}</label>)}</div></fieldset>;
}
