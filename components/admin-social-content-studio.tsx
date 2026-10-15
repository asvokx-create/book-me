"use client";

import { useMemo, useState } from "react";
import CustomSelect from "@/components/custom-select";

type Service = { id: string; title: string; businessName: string; category: string; city: string; state: string; slug: string };
const channels = ["Instagram", "Facebook", "LinkedIn", "Local community"] as const;

export default function AdminSocialContentStudio({ services }: { services: Service[] }) {
  const [selectedId, setSelectedId] = useState(services[0]?.id ?? "");
  const [channel, setChannel] = useState<(typeof channels)[number]>("Instagram");
  const [copied, setCopied] = useState(false);
  const selected = services.find((service) => service.id === selectedId);
  const initial = useMemo(() => {
    if (!selected) return "There are no active local listings available to feature yet.";
    const url = `https://bubsbookings.com/services/${selected.slug}`;
    const intro = channel === "LinkedIn" ? `Now available on BubsBookings: ${selected.businessName}, offering ${selected.category.toLowerCase()} in ${selected.city}, ${selected.state}.` : channel === "Local community" ? `Looking for ${selected.category.toLowerCase()} near ${selected.city}? ${selected.businessName} is now available on BubsBookings.` : `Now available in ${selected.city}: ${selected.businessName} on BubsBookings. Explore ${selected.category.toLowerCase()} and request a booking online.`;
    return `${intro}\n\nView the listing: ${url}\n\n#BubsBookings #${selected.city.replace(/[^a-z]/gi, "")} #${selected.category.replace(/[^a-z]/gi, "")}`;
  }, [channel, selected]);
  const [content, setContent] = useState("");
  const visibleContent = content || initial;
  const reset = () => setContent("");
  async function copy() { await navigator.clipboard.writeText(visibleContent); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
  return <section className="mt-7 rounded-[2rem] border border-[#183126]/10 bg-white p-5 sm:p-7"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#718078]">Manual publishing</p><h2 className="mt-2 text-2xl font-bold">Social content studio</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[#687970]">Build an editable post from a real active listing. Review each claim before copying it into a social platform; BubsBookings does not publish posts automatically.</p></div><div className="mt-5 grid gap-4 md:grid-cols-2"><label className="text-sm font-bold">Feature listing<CustomSelect ariaLabel="Feature listing" value={selectedId} onChange={(value) => { setSelectedId(value); setContent(""); }} className="mt-2" buttonClassName="w-full rounded-xl border border-[#183126]/15 bg-white px-3 py-3 font-normal">{services.map((service) => <option key={service.id} value={service.id}>{service.title} · {service.businessName} · {service.city}</option>)}</CustomSelect></label><label className="text-sm font-bold">Channel<CustomSelect ariaLabel="Social channel" value={channel} onChange={(value) => { setChannel(value as typeof channel); setContent(""); }} className="mt-2" buttonClassName="w-full rounded-xl border border-[#183126]/15 bg-white px-3 py-3 font-normal">{channels.map((item) => <option key={item}>{item}</option>)}</CustomSelect></label></div><textarea value={visibleContent} onChange={(event) => setContent(event.target.value)} rows={9} className="mt-5 w-full rounded-2xl border border-[#183126]/15 bg-[#f8f8f4] px-4 py-3 text-sm leading-6" aria-label="Editable social post" /> <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => void copy()} className="min-h-11 rounded-full bg-[#183126] px-5 text-sm font-bold text-white">{copied ? "Copied" : "Copy post"}</button><button type="button" onClick={reset} className="min-h-11 rounded-full border border-[#183126]/15 px-5 text-sm font-bold">Reset draft</button></div></section>;
}
