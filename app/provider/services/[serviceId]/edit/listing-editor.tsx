"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const categories = ["Home cleaning", "Car detailing", "Lawn & garden", "Handyman", "Photography"];
const durations = [
  { value: 60, label: "1 hour" },
  { value: 120, label: "2 hours" },
  { value: 180, label: "3 hours" },
  { value: 240, label: "Half day" },
  { value: 480, label: "Full day" },
];

type Listing = {
  id: string;
  slug: string;
  title: string;
  category: string;
  description: string;
  price: number;
  durationMinutes: number;
  location: string;
};

export default function ListingEditor({ serviceId }: { serviceId: string }) {
  const router = useRouter();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/providers/services/${serviceId}`)
      .then(async (response) => {
        const result = (await response.json()) as Listing & { error?: string };
        if (!response.ok) throw new Error(result.error ?? "Listing not found.");
        if (active) setListing(result);
      })
      .catch((reason: Error) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [serviceId]);

  function change<Key extends keyof Listing>(key: Key, value: Listing[Key]) {
    setListing((current) => current ? { ...current, [key]: value } : current);
    setSaved(false);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!listing) return;
    setSaving(true);
    setError("");
    const response = await fetch(`/api/providers/services/${serviceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(listing),
    });
    const result = (await response.json()) as { error?: string };
    setSaving(false);
    if (!response.ok) {
      setError(result.error ?? "We could not save your changes.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  async function deleteListing() {
    setDeleting(true);
    setError("");
    const response = await fetch(`/api/providers/services/${serviceId}`, { method: "DELETE" });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setDeleting(false);
      setConfirmDelete(false);
      setError(result.error ?? "We could not delete this listing.");
      return;
    }
    router.push("/provider/dashboard?listing=deleted");
    router.refresh();
  }

  const inputClass = "w-full rounded-2xl border border-[#183126]/15 bg-[#faf9f5] px-4 py-3.5 text-sm outline-none transition focus:border-[#4d725d] focus:ring-2 focus:ring-[#4d725d]/10";

  return (
    <main className="min-h-screen bg-[#f4f4ef] px-5 py-8 text-[#183126] sm:px-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <Link href="/provider/dashboard#services" className="text-sm font-bold text-[#60736a] hover:text-[#183126]">← Back to dashboard</Link>
        <div className="mt-6 rounded-[2rem] border border-[#183126]/10 bg-white p-6 shadow-[0_18px_50px_rgba(24,49,38,.08)] sm:p-9">
          <p className="text-xs font-bold uppercase tracking-[.14em] text-[#718078]">Manage listing</p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-.04em]">Edit your service</h1>
          <p className="mt-2 text-sm leading-6 text-[#6b7b73]">Updates appear on the public marketplace as soon as you save.</p>

          {loading && <div className="mt-8 h-72 animate-pulse rounded-2xl bg-[#eef0ea]" />}
          {!loading && !listing && <div className="mt-8 rounded-2xl bg-[#fff1e8] p-5 text-sm font-semibold text-[#9a4e25]">{error || "Listing not found."}</div>}
          {listing && <form onSubmit={save} className="mt-8 space-y-5">
            <label className="block"><span className="mb-2 block text-sm font-bold">Service title</span><input value={listing.title} onChange={(event) => change("title", event.target.value)} className={inputClass} /></label>
            <label className="block"><span className="mb-2 block text-sm font-bold">Category</span><select value={listing.category} onChange={(event) => change("category", event.target.value)} className={inputClass}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block"><span className="mb-2 block text-sm font-bold">Starting price</span><div className="relative"><span className="absolute left-4 top-3.5 text-sm text-[#65766d]">$</span><input type="number" min="1" step="0.01" value={listing.price} onChange={(event) => change("price", Number(event.target.value))} className={`${inputClass} pl-8`} /></div></label>
              <label className="block"><span className="mb-2 block text-sm font-bold">Typical duration</span><select value={listing.durationMinutes} onChange={(event) => change("durationMinutes", Number(event.target.value))} className={inputClass}>{durations.map((duration) => <option key={duration.value} value={duration.value}>{duration.label}</option>)}</select></label>
            </div>
            <label className="block"><span className="mb-2 block text-sm font-bold">Service area</span><input value={listing.location} onChange={(event) => change("location", event.target.value)} placeholder="City, State" className={inputClass} /><span className="mt-2 block text-xs text-[#849189]">This location is shared across your provider profile and listings.</span></label>
            <label className="block"><span className="mb-2 block text-sm font-bold">Description</span><textarea rows={6} value={listing.description} onChange={(event) => change("description", event.target.value)} className={`${inputClass} resize-none`} /></label>

            {error && <p role="alert" className="rounded-xl bg-[#fff1e8] px-3 py-2.5 text-xs font-semibold text-[#9a4e25]">{error}</p>}
            {saved && <p role="status" className="rounded-xl bg-[#e6f1e5] px-3 py-2.5 text-xs font-semibold text-[#3f7652]">Your listing changes are live.</p>}
            <div className="flex flex-col-reverse justify-between gap-3 border-t border-[#183126]/10 pt-6 sm:flex-row sm:items-center">
              <button type="button" onClick={() => setConfirmDelete(true)} className="rounded-full px-5 py-3 text-sm font-bold text-[#9a4e3a] hover:bg-[#fff0ea]">Delete listing</button>
              <div className="flex gap-3"><Link href={`/services/${listing.slug}`} className="rounded-full border border-[#183126]/15 px-5 py-3 text-sm font-bold">View public page</Link><button type="submit" disabled={saving} className="rounded-full bg-[#eee25a] px-6 py-3 text-sm font-bold disabled:cursor-wait disabled:opacity-60">{saving ? "Saving…" : "Save changes"}</button></div>
            </div>
          </form>}
        </div>
      </div>

      {confirmDelete && listing && <div role="dialog" aria-modal="true" aria-labelledby="delete-title" className="fixed inset-0 z-50 grid place-items-center bg-[#10241b]/60 p-5 backdrop-blur-sm"><div className="w-full max-w-md rounded-[2rem] bg-white p-7 shadow-2xl"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#fff0ea] text-xl">⚠</span><h2 id="delete-title" className="mt-5 text-2xl font-bold">Delete this listing?</h2><p className="mt-3 text-sm leading-6 text-[#687970]"><strong>{listing.title}</strong> will immediately disappear from customer searches. This action cannot be undone from the dashboard.</p><div className="mt-7 flex justify-end gap-3"><button type="button" disabled={deleting} onClick={() => setConfirmDelete(false)} className="rounded-full border border-[#183126]/15 px-5 py-3 text-sm font-bold">Keep listing</button><button type="button" disabled={deleting} onClick={deleteListing} className="rounded-full bg-[#9a4e3a] px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{deleting ? "Deleting…" : "Yes, delete"}</button></div></div></div>}
    </main>
  );
}
