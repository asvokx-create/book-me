"use client";

import { ChangeEvent, useState } from "react";
import ProfileAvatar from "@/components/profile-avatar";

const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
const maxBytes = 3 * 1024 * 1024;

export default function ProfilePhotoManager({ name, initialUrl, onChange }: { name: string; initialUrl: string; onChange: (url: string) => void }) {
  const [imageUrl, setImageUrl] = useState(initialUrl);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const image = event.target.files?.[0];
    event.target.value = "";
    if (!image) return;
    if (!allowedTypes.includes(image.type) || image.size > maxBytes) {
      setMessage("Choose a JPG, PNG, or WebP photo under 3 MB.");
      return;
    }
    setBusy(true); setMessage("");
    const formData = new FormData();
    formData.set("image", image);
    const response = await fetch("/api/account/profile-photo", { method: "POST", body: formData }).catch(() => null);
    const result = response ? await response.json() as { imageUrl?: string; error?: string } : null;
    setBusy(false);
    if (!response?.ok || !result?.imageUrl) { setMessage(result?.error ?? "We could not upload that photo."); return; }
    setImageUrl(result.imageUrl); onChange(result.imageUrl); setMessage("Profile photo updated.");
  }

  async function remove() {
    if (!imageUrl || !window.confirm("Remove your profile photo? Your initials will be shown instead.")) return;
    setBusy(true); setMessage("");
    const response = await fetch("/api/account/profile-photo", { method: "DELETE" }).catch(() => null);
    const result = response ? await response.json() as { error?: string } : null;
    setBusy(false);
    if (!response?.ok) { setMessage(result?.error ?? "We could not remove that photo."); return; }
    setImageUrl(""); onChange(""); setMessage("Profile photo removed.");
  }

  return (
    <div className="mt-6 flex flex-col gap-4 rounded-2xl bg-[#f7f7f2] p-5 sm:flex-row sm:items-center">
      <ProfileAvatar name={name} imageUrl={imageUrl} className="h-20 w-20 text-xl ring-4 ring-white" />
      <div className="min-w-0 flex-1"><p className="text-sm font-bold">Profile photo</p><p className="mt-1 text-xs leading-5 text-[#738179]">Shown on your account, bookings, messages, and provider profile.</p>{message && <p aria-live="polite" className={`mt-2 text-xs font-semibold ${message.includes("updated") || message.includes("removed") ? "text-[#34704a]" : "text-[#9a4e25]"}`}>{message}</p>}</div>
      <div className="flex flex-wrap gap-2"><label className="cursor-pointer rounded-full bg-[#183126] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#315846]">{busy ? "Saving…" : imageUrl ? "Replace" : "Add photo"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={upload} className="sr-only" /></label>{imageUrl && <button type="button" disabled={busy} onClick={remove} className="rounded-full border border-[#183126]/15 px-4 py-2.5 text-xs font-bold transition hover:bg-[#f2ddd4]">Remove</button>}</div>
    </div>
  );
}

