"use client";

import { useEffect, useMemo, useState } from "react";
import CustomSelect from "@/components/custom-select";

type Prospect = { id: string; business_name: string; website: string | null; public_email: string | null; public_phone: string | null; public_address: string | null; city: string; state: string; service_category: string; contact_source: string; research_notes: string; status: string; last_contacted_at: string | null; replied_at: string | null; draft_count: number };
type Draft = { id: string; prospect_id: string; subject: string; body: string; status: "draft" | "approved" | "archived"; approval_note: string; approved_at: string | null; created_at: string };
type DiscoveryResult = { id: string; businessName: string; address: string; publicPhone: string; website: string; category: string; mapsUrl: string; publicEmail?: string; emailSource?: string; emailChecked?: boolean };
type DiscoveryBudget = { month: string; limit: number; used: number; remaining: number };
const statuses = ["researching", "contact_ready", "contacted", "replied", "interested", "registered", "not_interested", "suppressed"];

async function readApiJson(response: Response | null) {
  const body = await response?.text().catch(() => "");
  if (!body) return null;
  try { return JSON.parse(body) as { error?: unknown; results?: DiscoveryResult[]; placesDiscoveryBudget?: DiscoveryBudget; publicEmail?: unknown; emailSource?: unknown; message?: unknown }; }
  catch { return null; }
}

export default function AdminProviderOutreach() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ businessName: "", website: "", publicEmail: "", publicPhone: "", publicAddress: "", city: "Issaquah", state: "WA", category: "", contactSource: "", researchNotes: "" });
  const [approval, setApproval] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState("all");
  const [discovery, setDiscovery] = useState({ city: "Issaquah", state: "WA", category: "" });
  const [discoveryResults, setDiscoveryResults] = useState<DiscoveryResult[]>([]);
  const [placesDiscoveryBudget, setPlacesDiscoveryBudget] = useState<DiscoveryBudget | null>(null);
  const [outreachSender, setOutreachSender] = useState("");

  async function load() {
    setLoading(true); setError("");
    const response = await fetch("/api/admin/growth/outreach", { cache: "no-store" }).catch(() => null);
    const data = await response?.json().catch(() => null);
    if (!response?.ok) setError(data?.error || "Outreach records could not be loaded.");
    else { setProspects(data.prospects || []); setDrafts(data.drafts || []); setPlacesDiscoveryBudget(data.placesDiscoveryBudget || null); setOutreachSender(typeof data.outreachSender === "string" ? data.outreachSender : ""); }
    setLoading(false);
  }
  useEffect(() => {
    let active = true;
    void fetch("/api/admin/growth/outreach", { cache: "no-store" }).then(async (response) => {
      const data = await response.json().catch(() => null);
      if (!active) return;
      if (!response.ok) setError(data?.error || "Outreach records could not be loaded.");
      else { setProspects(data.prospects || []); setDrafts(data.drafts || []); setPlacesDiscoveryBudget(data.placesDiscoveryBudget || null); setOutreachSender(typeof data.outreachSender === "string" ? data.outreachSender : ""); }
      setLoading(false);
    }).catch(() => { if (active) { setError("Outreach records could not be loaded."); setLoading(false); } });
    return () => { active = false; };
  }, []);

  async function action(payload: Record<string, unknown>, success: string) {
    const key = String(payload.action) + String(payload.prospectId || payload.draftId || "");
    setBusy(key); setError(""); setNotice("");
    const response = await fetch("/api/admin/growth/outreach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).catch(() => null);
    const data = await response?.json().catch(() => null);
    if (!response?.ok) setError(data?.error || "That outreach action could not be completed.");
    else { setNotice(success); await load(); }
    setBusy("");
  }
  async function discover() {
    setBusy("discover"); setError(""); setNotice(""); setDiscoveryResults([]);
    const response = await fetch("/api/admin/growth/outreach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "discover", ...discovery }) }).catch(() => null);
    const data = await readApiJson(response);
    if (!response) setError("Provider discovery could not reach BubsBookings. Check your connection and try again.");
    else if (!response.ok) {
      const safeError = typeof data?.error === "string" ? data.error : "";
      if (safeError) setError(safeError);
      else if (response.status === 504) setError("Provider discovery timed out before Google responded. Please try again shortly.");
      else setError(`Provider discovery is temporarily unavailable (request ${response.status}). Please try again later.`);
    }
    else { setDiscoveryResults(data?.results || []); setNotice(`${data?.results?.length || 0} public business results found. Review each one before saving.`); }
    if (data?.placesDiscoveryBudget) setPlacesDiscoveryBudget(data.placesDiscoveryBudget);
    setBusy("");
  }
  async function findPublicEmail(result: DiscoveryResult) {
    const resultKey = result.id || result.businessName;
    setBusy(`email-${resultKey}`); setError(""); setNotice("");
    const response = await fetch("/api/admin/growth/outreach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "find_public_email", resultId: result.id, businessName: result.businessName, website: result.website }) }).catch(() => null);
    const data = await readApiJson(response);
    if (!response?.ok) setError(typeof data?.error === "string" ? data.error : "The public business website could not be reviewed right now.");
    else {
      const publicEmail = typeof data?.publicEmail === "string" ? data.publicEmail : "";
      const emailSource = typeof data?.emailSource === "string" ? data.emailSource : "";
      setDiscoveryResults((current) => current.map((item) => (item.id || item.businessName) === resultKey ? { ...item, publicEmail, emailSource, emailChecked: true } : item));
      setNotice(typeof data?.message === "string" ? data.message : "Public business contact details were reviewed.");
    }
    setBusy("");
  }
  function populateProspectFromDiscovery(result: DiscoveryResult) {
    setForm((current) => ({ ...current, businessName: result.businessName, website: result.website, publicEmail: result.publicEmail || "", publicPhone: result.publicPhone, publicAddress: result.address, city: discovery.city, state: discovery.state, category: current.category || discovery.category, contactSource: result.emailSource || result.mapsUrl || "Google Places search", researchNotes: result.publicEmail ? "Public Google Places result. A public email was found on the linked business website; review its source before saving." : "Public Google Places result. Review all imported details before saving." }));
    setNotice(result.publicEmail ? "Public address, phone, website, and a reviewable public email were added to the form." : "Public address, phone, and website were added to the form. You can use Find public email to review the business website first.");
  }
  const shown = useMemo(() => prospects.filter((prospect) => filter === "all" || prospect.status === filter), [filter, prospects]);
  const draftsByProspect = useMemo(() => new Map(drafts.map((draft) => [draft.prospect_id, draft])), [drafts]);

  return <div className="mt-7 space-y-7">
    <section className="rounded-[2rem] border border-[#183126]/10 bg-[#fff9d8] p-5 sm:p-7"><h2 className="text-xl font-bold">Human-reviewed outreach only</h2><p className="mt-2 max-w-4xl text-sm leading-6 text-[#687052]">This workspace stores public business contact details and creates drafts. It does not send email. An approved draft is still not deliverable until BubsBookings has a real mailing address, a working opt-out link, and a separately reviewed sending process.</p>{outreachSender && <p className="mt-3 text-sm font-bold text-[#52665b]">Future approved outreach sender: {outreachSender}</p>}</section>
    {error && <p role="alert" className="rounded-2xl bg-[#fff0e8] p-4 text-sm font-bold text-[#964f2c]">{error}</p>}{notice && <p role="status" className="rounded-2xl bg-[#e6f1e5] p-4 text-sm font-bold text-[#34704a]">{notice}</p>}
    <section className="rounded-[2rem] border border-[#183126]/10 bg-white p-5 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold">Find public businesses</h2><p className="mt-1 max-w-3xl text-sm text-[#718078]">Search Google Places for local businesses, then review and save only the prospects you want. Google does not provide business email addresses, but Find public email can review a business&apos;s own public contact pages.</p></div>{placesDiscoveryBudget && <p className="rounded-full bg-[#f5f5ef] px-3 py-2 text-xs font-bold text-[#52665b]">Discovery budget: {placesDiscoveryBudget.used.toLocaleString()} / {placesDiscoveryBudget.limit.toLocaleString()} used · {placesDiscoveryBudget.remaining.toLocaleString()} remaining</p>}</div><form className="mt-5 grid gap-3 md:grid-cols-[1fr_120px_1fr_auto]" onSubmit={(event) => { event.preventDefault(); void discover(); }}><label className="text-sm font-bold">City<input value={discovery.city} onChange={(event) => setDiscovery((current) => ({ ...current, city: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-[#183126]/15 bg-white px-3 py-3 font-normal" /></label><label className="text-sm font-bold">State<input value={discovery.state} onChange={(event) => setDiscovery((current) => ({ ...current, state: event.target.value.toUpperCase() }))} maxLength={2} className="mt-1.5 w-full rounded-xl border border-[#183126]/15 bg-white px-3 py-3 font-normal" /></label><label className="text-sm font-bold">Service category<input value={discovery.category} onChange={(event) => setDiscovery((current) => ({ ...current, category: event.target.value }))} placeholder="Car detailing" className="mt-1.5 w-full rounded-xl border border-[#183126]/15 bg-white px-3 py-3 font-normal" /></label><button disabled={busy === "discover" || !discovery.category.trim() || placesDiscoveryBudget?.remaining === 0} className="mt-auto min-h-12 rounded-full bg-[#183126] px-5 text-sm font-bold text-white disabled:opacity-50">{busy === "discover" ? "Searching…" : "Search businesses"}</button></form>{discoveryResults.length > 0 && <div className="mt-5 grid gap-3 lg:grid-cols-2">{discoveryResults.map((result) => <article key={result.id || result.businessName} className="rounded-2xl bg-[#f5f5ef] p-4"><h3 className="font-bold">{result.businessName}</h3><p className="mt-1 text-sm text-[#687970]">{result.address || "Address not provided"}</p><p className="mt-1 text-xs text-[#718078]">{result.category || "Business category not provided"}</p>{result.publicEmail ? <p className="mt-2 text-sm font-bold text-[#34704a]">Public email found: {result.publicEmail}</p> : result.emailChecked ? <p className="mt-2 text-sm font-bold text-[#718078]">No public email found on the pages checked.</p> : null}{result.emailSource && <a href={result.emailSource} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs font-bold underline">Review email source</a>}<div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => populateProspectFromDiscovery(result)} className="rounded-full bg-white px-3 py-2 text-sm font-bold">Use in prospect form</button>{result.website && <button type="button" disabled={busy === `email-${result.id || result.businessName}`} onClick={() => void findPublicEmail(result)} className="rounded-full bg-white px-3 py-2 text-sm font-bold disabled:opacity-50">{busy === `email-${result.id || result.businessName}` ? "Checking public pages…" : result.publicEmail ? "Check public email again" : "Find public email"}</button>}{result.mapsUrl && <a href={result.mapsUrl} target="_blank" rel="noopener noreferrer" className="rounded-full bg-white px-3 py-2 text-sm font-bold">Review source</a>}</div></article>)}</div>}</section>
    <section className="rounded-[2rem] border border-[#183126]/10 bg-white p-5 sm:p-7"><h2 className="text-xl font-bold">Add a potential provider</h2><p className="mt-1 text-sm text-[#718078]">Only enter public business contact details that you have reviewed. Duplicate businesses in the same city are blocked.</p><form className="mt-5 grid gap-3 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void action({ action: "create", ...form }, "Provider prospect added.").then(() => setForm({ businessName: "", website: "", publicEmail: "", publicPhone: "", publicAddress: "", city: "Issaquah", state: "WA", category: "", contactSource: "", researchNotes: "" })); }}>
      {[["Business name", "businessName", "Example Services"], ["Website", "website", "https://example.com"], ["Public business email", "publicEmail", "hello@example.com"], ["Public phone", "publicPhone", "(425) 555-0123"], ["Public address", "publicAddress", "123 Main St, Issaquah, WA 98027"], ["City", "city", "Issaquah"], ["State", "state", "WA"], ["Service category", "category", "Car detailing"], ["Research source", "contactSource", "Public business website"]].map(([label, key, placeholder]) => <label key={key} className="text-sm font-bold">{label}<input value={form[key as keyof typeof form]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} placeholder={placeholder} className="mt-1.5 w-full rounded-xl border border-[#183126]/15 bg-white px-3 py-3 font-normal" /></label>)}
      <label className="md:col-span-2 text-sm font-bold">Research notes<textarea value={form.researchNotes} onChange={(event) => setForm((current) => ({ ...current, researchNotes: event.target.value }))} maxLength={4000} rows={3} className="mt-1.5 w-full rounded-xl border border-[#183126]/15 bg-white px-3 py-3 font-normal" placeholder="Public details, fit, or follow-up context." /></label><button disabled={Boolean(busy)} className="w-fit rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">Add provider prospect</button>
    </form></section>
    <section className="rounded-[2rem] border border-[#183126]/10 bg-white p-5 sm:p-7"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-bold">Provider outreach pipeline</h2><p className="mt-1 text-sm text-[#718078]">Track research, contact outcomes, and reviewed drafts without sending anything.</p></div><label className="text-sm font-bold">Filter<CustomSelect ariaLabel="Outreach filter" value={filter} onChange={setFilter} className="ml-2 inline-block" buttonClassName="rounded-xl border border-[#183126]/15 bg-white px-3 py-2 font-normal"><option value="all">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</CustomSelect></label></div>
      <div className="mt-5 space-y-4">{loading ? <p className="text-sm text-[#718078]">Loading outreach records…</p> : shown.length ? shown.map((prospect) => { const draft = draftsByProspect.get(prospect.id); return <article key={prospect.id} className="rounded-2xl bg-[#f5f5ef] p-5"><div className="flex flex-col justify-between gap-3 lg:flex-row"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-bold">{prospect.business_name}</h3><span className="rounded-full bg-white px-3 py-1 text-xs font-bold capitalize">{prospect.status.replaceAll("_", " ")}</span></div><p className="mt-1 text-sm text-[#687970]">{prospect.service_category} · {prospect.city}, {prospect.state}</p><p className="mt-2 text-xs text-[#718078]">{prospect.public_email || "No public email"}{prospect.public_phone ? ` · ${prospect.public_phone}` : ""}{prospect.website ? ` · ${prospect.website}` : ""}</p>{prospect.public_address && <p className="mt-1 text-xs text-[#718078]">{prospect.public_address}</p>}{prospect.research_notes && <p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm leading-6">{prospect.research_notes}</p>}</div><div className="flex flex-wrap gap-2"><CustomSelect ariaLabel="Outreach status" value={prospect.status} onChange={(status) => void action({ action: "status", prospectId: prospect.id, status }, "Outreach status updated.")} disabled={Boolean(busy)} buttonClassName="min-h-11 rounded-full border border-[#183126]/15 bg-white px-3 text-sm font-bold">{statuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</CustomSelect><button type="button" disabled={Boolean(busy) || !prospect.public_email || prospect.status === "suppressed"} onClick={() => void action({ action: "draft", prospectId: prospect.id }, "Personalized draft created for review.")} className="min-h-11 rounded-full bg-[#183126] px-4 text-sm font-bold text-white disabled:opacity-40">Create draft</button><button type="button" disabled={Boolean(busy) || !prospect.public_email || prospect.status === "suppressed"} onClick={() => void action({ action: "suppress", prospectId: prospect.id, reason: "manual" }, "Contact permanently suppressed.")} className="min-h-11 rounded-full border border-[#a55c42]/25 px-4 text-sm font-bold text-[#954b32] disabled:opacity-40">Suppress</button></div></div>
        {draft && <details className="mt-4 rounded-xl border border-[#183126]/10 bg-white p-4"><summary className="cursor-pointer font-bold">Latest draft · {draft.status}{draft.approved_at ? ` · approved ${new Date(draft.approved_at).toLocaleDateString()}` : ""}</summary><p className="mt-3 text-sm font-bold">{draft.subject}</p><pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-6 text-[#52665b]">{draft.body}</pre>{draft.status === "draft" && <div className="mt-4 flex flex-wrap gap-2"><input value={approval[draft.id] || ""} onChange={(event) => setApproval((current) => ({ ...current, [draft.id]: event.target.value }))} placeholder="Required approval note" className="min-h-11 rounded-xl border border-[#183126]/15 px-3 text-sm" /><button type="button" disabled={Boolean(busy)} onClick={() => void action({ action: "approve_draft", prospectId: prospect.id, draftId: draft.id, approvalNote: approval[draft.id] || "" }, "Draft approved for the future reviewed sending process.")} className="min-h-11 rounded-full bg-[#eee25a] px-4 text-sm font-bold">Approve draft</button></div>}</details>}
      </article>; }) : <p className="rounded-2xl bg-[#f5f5ef] p-6 text-sm text-[#718078]">No provider prospects match this filter yet.</p>}</div>
    </section>
  </div>;
}
