"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

const input = "w-full rounded-2xl border border-[#183126]/15 bg-white px-4 py-3.5 text-base outline-none focus:border-[#4d725d] focus:ring-2 focus:ring-[#4d725d]/15";
const optionClass = "flex min-h-12 items-center gap-3 rounded-2xl border border-[#183126]/12 bg-white px-4 py-3 text-sm font-bold";
const partnershipTypes = ["Fixed campaign payment", "Revenue share", "Hybrid partnership", "Sponsored placement", "Newsletter promotion", "Website / blog promotion", "Social media promotion", "Other"];
const platformOptions = ["YouTube", "TikTok", "Instagram", "Facebook", "X", "Newsletter / Email", "Website / Blog", "Podcast", "Community", "Other"];
const promotionOptions = ["Newsletter placement", "Dedicated email", "Website banner", "Blog placement", "YouTube integration", "Dedicated video", "TikTok video", "Instagram Reel", "Instagram Story", "Social post", "Podcast mention", "Community promotion", "Other"];

function ToggleOptions({ legend, name, options }: { legend: string; name: string; options: string[] }) {
  return <fieldset><legend className="text-sm font-bold">{legend}</legend><div className="mt-3 grid gap-2 sm:grid-cols-2">{options.map(option => <label key={option} className={optionClass}><input name={name} type="checkbox" value={option} className="h-5 w-5 shrink-0 accent-[#183126]"/><span>{option}</span></label>)}</div></fieldset>;
}

export default function PartnerApplicationForm() {
  const [status, setStatus] = useState<"idle" | "saving" | "sent">("idle");
  const [error, setError] = useState("");
  const [audienceSize, setAudienceSize] = useState("");
  const [customRequested, setCustomRequested] = useState(false);

  function updateAudienceSize(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 15);
    setAudienceSize(digits.replace(/\B(?=(\d{3})+(?!\d))/g, ","));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setStatus("saving"); setError("");
    const form = new FormData(event.currentTarget);
    const body: Record<string, unknown> = Object.fromEntries(form);
    body.audienceSize = audienceSize.replace(/,/g, "");
    body.customPartnershipRequested = customRequested;
    body.customPartnershipTypes = form.getAll("customPartnershipTypes");
    body.platforms = form.getAll("platforms");
    body.promotionTypes = form.getAll("promotionTypes");
    const response = await fetch("/api/affiliates/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json() as { error?: string };
    if (!response.ok) { setStatus("idle"); setError(result.error ?? "We could not submit your application."); return; }
    setStatus("sent");
  }
  if (status === "sent") return <div className="rounded-[2rem] border border-[#8eaa91] bg-[#edf5e9] p-7"><h2 className="text-2xl font-bold">Application received</h2><p className="mt-2 leading-7 text-[#5d7066]">{customRequested ? "We received your custom partnership request and will review the audience and promotion information you provided." : "We will review your audience, promotion plan, and fit for the Standard Partner Program."} Applying does not automatically approve or activate a Partner account.</p></div>;
  return <form onSubmit={submit} className="rounded-[2rem] border border-[#183126]/10 bg-[#f7f7f2] p-5 sm:p-8">
    <h2 className="text-2xl font-bold">Apply to become a partner</h2><p className="mt-2 text-sm leading-6 text-[#687970]">Tell us who you reach and how you plan to introduce legitimate service providers to BubsBookings.</p>
    <div className="mt-6 grid gap-4 sm:grid-cols-2">
      <label className="font-bold">Name<input name="name" required autoComplete="name" maxLength={120} className={`${input} mt-2`} /></label>
      <label className="font-bold">Email<input name="email" required type="email" autoComplete="email" maxLength={254} className={`${input} mt-2`} /></label>
      <label className="font-bold">Website <span className="font-normal text-[#718078]">(optional)</span><input name="website" type="url" inputMode="url" maxLength={500} className={`${input} mt-2`} /></label>
      <label className="font-bold">Audience size <span className="font-normal text-[#718078]">(optional)</span><input name="audienceSize" value={audienceSize} onChange={(event) => updateAudienceSize(event.target.value)} inputMode="numeric" autoComplete="off" className={`${input} mt-2`} placeholder="e.g. 10,000" /></label>
      <label className="font-bold">YouTube <span className="font-normal text-[#718078]">(optional)</span><input name="youtube" type="url" inputMode="url" maxLength={500} className={`${input} mt-2`} /></label>
      <label className="font-bold">Instagram <span className="font-normal text-[#718078]">(optional)</span><input name="instagram" type="url" inputMode="url" maxLength={500} className={`${input} mt-2`} /></label>
      <label className="font-bold">TikTok <span className="font-normal text-[#718078]">(optional)</span><input name="tiktok" type="url" inputMode="url" maxLength={500} className={`${input} mt-2`} /></label>
      <label className="font-bold">Other social profile <span className="font-normal text-[#718078]">(optional)</span><input name="otherSocial" type="url" inputMode="url" maxLength={500} className={`${input} mt-2`} /></label>
    </div>
    <label className="mt-4 block font-bold">Who is your primary audience?<textarea name="primaryAudience" required minLength={10} maxLength={500} rows={3} className={`${input} mt-2 resize-y`} /></label>
    <label className="mt-4 block font-bold">How will you promote BubsBookings?<textarea name="promotionPlan" required minLength={30} maxLength={2000} rows={5} className={`${input} mt-2 resize-y`} /></label>
    <label className="mt-4 block font-bold">Additional notes <span className="font-normal text-[#718078]">(optional)</span><textarea name="notes" maxLength={2000} rows={3} className={`${input} mt-2 resize-y`} /></label>

    <section className="mt-6 rounded-[1.5rem] border border-[#183126]/12 bg-white p-4 sm:p-5" aria-labelledby="custom-partnership-heading">
      <div><h3 id="custom-partnership-heading" className="text-lg font-bold">Interested in a custom partnership?</h3><p className="mt-1 text-sm leading-6 text-[#687970]">Most Partners use the standard program. Select this only if you have a larger audience or a different campaign idea you would like BubsBookings to review.</p></div>
      <label className="mt-4 flex min-h-12 cursor-pointer items-start gap-3 rounded-2xl bg-[#eef3e9] p-4 font-bold"><input type="checkbox" checked={customRequested} onChange={event => setCustomRequested(event.target.checked)} aria-controls="custom-partnership-fields" aria-expanded={customRequested} className="mt-0.5 h-5 w-5 shrink-0 accent-[#183126]"/><span>I&apos;d like to discuss a custom program</span></label>
      {customRequested && <div id="custom-partnership-fields" className="mt-6 grid gap-6 border-t border-[#183126]/10 pt-6">
        <div><h3 className="text-lg font-bold">Your custom partnership idea</h3><p className="mt-1 text-sm leading-6 text-[#687970]">This helps us understand what you want to discuss. It does not set or guarantee compensation.</p></div>
        <ToggleOptions legend="What type of partnership are you interested in? Select at least one." name="customPartnershipTypes" options={partnershipTypes}/>
        <ToggleOptions legend="Which platforms do you actively use?" name="platforms" options={platformOptions}/>
        <ToggleOptions legend="What kind of promotion could you offer?" name="promotionTypes" options={promotionOptions}/>
        <fieldset><legend className="text-sm font-bold">Tell us about your audience <span className="font-normal text-[#718078]">(optional)</span></legend><div className="mt-3 grid gap-4 sm:grid-cols-2">
          {[["followerCount","Followers"],["subscriberCount","Subscribers"],["emailListSize","Email list size"],["monthlyTraffic","Monthly website traffic"],["averageContentViews","Average content views"]].map(([name,label])=><label key={name} className="text-sm font-bold">{label}<input name={name} type="number" inputMode="numeric" min="0" max="2000000000" step="1" className={`${input} mt-2`}/></label>)}
          <label className="text-sm font-bold sm:col-span-2">Other relevant audience size<input name="otherAudienceSize" maxLength={120} className={`${input} mt-2`} placeholder="For example, 8,000 community members"/></label>
        </div></fieldset>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">Media kit or rate card URL <span className="font-normal text-[#718078]">(optional)</span><input name="mediaKitUrl" type="url" inputMode="url" maxLength={500} className={`${input} mt-2`}/></label><label className="text-sm font-bold">Portfolio URL <span className="font-normal text-[#718078]">(optional)</span><input name="portfolioUrl" type="url" inputMode="url" maxLength={500} className={`${input} mt-2`}/></label></div>
        <label className="text-sm font-bold">Tell us more about the partnership you have in mind <span className="font-normal text-[#718078]">(optional)</span><textarea name="customPartnershipNotes" maxLength={1200} rows={4} className={`${input} mt-2 resize-y`}/><span className="mt-2 block text-xs font-normal text-[#718078]">Up to 1,200 characters. Do not include private or sensitive information.</span></label>
      </div>}
    </section>

    <div className="mt-5 rounded-2xl border border-[#183126]/10 bg-white p-4 text-xs leading-5 text-[#687970]"><p>Partners must clearly disclose compensated links, avoid misleading claims, and may only refer legitimate new providers. Commissions are subject to qualification, refund, dispute, fraud, and holding-period rules.</p><label className="mt-3 flex cursor-pointer items-start gap-3 text-sm leading-6 text-[#183126]"><input name="partnerAgreementAccepted" type="checkbox" value="true" required className="mt-1 h-5 w-5 shrink-0 accent-[#183126]" /><span>I have reviewed and agree to the <Link href="/partner-agreement" target="_blank" className="font-bold underline underline-offset-2">Partner Agreement</Link>. Submission is an application only; it does not approve or activate a partnership.</span></label></div>
    {error && <p role="alert" className="mt-4 rounded-xl bg-[#fff1e8] p-3 text-sm font-bold text-[#9a4e25]">{error}</p>}
    <button disabled={status === "saving"} className="mt-5 min-h-12 w-full rounded-full bg-[#eee25a] px-6 py-3.5 font-bold disabled:opacity-60">{status === "saving" ? "Submitting…" : "Submit application"}</button>
  </form>;
}
