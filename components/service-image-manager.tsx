"use client";

import { ChangeEvent, useState } from "react";

type ServiceImageManagerProps = {
  serviceId: string;
  initialImageUrls: string[];
  compact?: boolean;
};

const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
const maxBytes = 5 * 1024 * 1024;

export default function ServiceImageManager({ serviceId, initialImageUrls, compact = false }: ServiceImageManagerProps) {
  const [imageUrls, setImageUrls] = useState(initialImageUrls);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  async function addImages(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (selected.length === 0) return;
    if (selected.some((file) => !allowedTypes.includes(file.type) || file.size > maxBytes)) {
      setMessage("Use JPG, PNG, or WebP photos under 5 MB each.");
      return;
    }
    if (imageUrls.length + selected.length > 5) {
      setMessage(`You can add ${5 - imageUrls.length} more ${5 - imageUrls.length === 1 ? "photo" : "photos"}.`);
      return;
    }

    setUploading(true);
    setMessage("");
    const uploaded: string[] = [];
    for (const file of selected) {
      const formData = new FormData();
      formData.set("image", file);
      const response = await fetch(`/api/providers/services/${serviceId}/images`, { method: "POST", body: formData });
      const result = (await response.json()) as { image?: { url: string }; error?: string };
      if (!response.ok || !result.image) {
        setMessage(result.error ?? "One of the photos could not be uploaded.");
        break;
      }
      uploaded.push(result.image.url);
      setImageUrls((current) => [...current, result.image!.url]);
    }
    if (uploaded.length === selected.length) setMessage(`${uploaded.length} ${uploaded.length === 1 ? "photo" : "photos"} added.`);
    setUploading(false);
  }

  return (
    <div className={compact ? "mt-4" : "mt-6 rounded-2xl border border-[#183126]/10 bg-[#faf9f5] p-5"}>
      {!compact && <div><p className="text-sm font-bold">Listing photos</p><p className="mt-1 text-xs leading-5 text-[#74827b]">Add up to 5 photos. Your first photo is the cover customers see.</p></div>}
      {imageUrls.length > 0 && <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">{imageUrls.map((url, index) => <div key={url} role="img" aria-label={`Listing photo ${index + 1}`} style={{ backgroundImage: `url("${url}")` }} className="relative aspect-square rounded-xl bg-[#e4e9e2] bg-cover bg-center">{index === 0 && <span className="absolute bottom-1.5 left-1.5 rounded-full bg-white/90 px-2 py-1 text-[9px] font-bold shadow-sm">Cover</span>}</div>)}</div>}
      <label className="mt-4 inline-flex cursor-pointer items-center rounded-full border border-[#183126]/15 bg-white px-4 py-2.5 text-xs font-bold transition hover:border-[#4d725d]">
        {uploading ? "Uploading…" : imageUrls.length === 0 ? "+ Add photos" : "+ Add more photos"}
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploading || imageUrls.length >= 5} onChange={addImages} className="sr-only" />
      </label>
      {imageUrls.length >= 5 && <p className="mt-2 text-xs text-[#74827b]">Photo limit reached.</p>}
      {message && <p aria-live="polite" className={`mt-2 text-xs font-semibold ${message.includes("added") ? "text-[#3f7652]" : "text-[#9a4e25]"}`}>{message}</p>}
    </div>
  );
}
