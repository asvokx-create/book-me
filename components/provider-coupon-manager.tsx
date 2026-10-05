"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import CustomSelect from "@/components/custom-select";

type Coupon = {
  id: string;
  serviceId: string | null;
  serviceTitle: string | null;
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minimumSubtotalCents: number;
  firstBookingOnly: boolean;
  repeatCustomerOnly: boolean;
  expiresAt: string | null;
  expiresOn: string | null;
  usageLimit: number | null;
  redemptionCount: number;
  isActive: boolean;
};

async function responseJson<T>(response: Response | null) {
  if (!response) return null;
  return response.json().catch(() => null) as Promise<T | null>;
}

const discountOptions = [
  { value: "percentage", label: "Percentage" },
  { value: "fixed", label: "Fixed amount" },
] as const;

export default function ProviderCouponManager({ services, allowed }: { services: Array<{ id: string; title: string }>; allowed: boolean }) {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Coupon | null>(null);
  const [form, setForm] = useState({
    code: "",
    serviceId: "",
    discountType: "percentage" as "percentage" | "fixed",
    discountValue: "10",
    minimumSubtotal: "0",
    firstBookingOnly: false,
    repeatCustomerOnly: false,
    expiresAt: "",
    usageLimit: "",
  });

  const serviceOptions = [
    { value: "", label: "All my services" },
    ...services.map((service) => ({ value: service.id, label: service.title })),
  ];

  async function load() {
    const response = await fetch("/api/providers/coupons", { cache: "no-store" }).catch(() => null);
    const data = await responseJson<{ coupons: Coupon[]; error?: string }>(response);
    if (response?.ok && data?.coupons) setCoupons(data.coupons);
    else setError(data?.error ?? "Coupons could not be loaded. Please try again.");
    setLoading(false);
  }

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/providers/coupons", { cache: "no-store", signal: controller.signal })
      .then(async (response) => ({ response, data: await responseJson<{ coupons: Coupon[]; error?: string }>(response) }))
      .then(({ response, data }) => {
        if (response.ok && data?.coupons) setCoupons(data.coupons);
        else setError(data?.error ?? "Coupons could not be loaded. Please try again.");
      })
      .catch((error) => {
        if ((error as { name?: string }).name !== "AbortError") setError("Coupons could not be loaded. Please try again.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    setWorking(true);
    setError("");
    setSaved("");
    try {
      const response = await fetch("/api/providers/coupons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await responseJson<{ error?: string }>(response);
      if (!response.ok) {
        setError(data?.error ?? "We could not create this coupon.");
        return;
      }
      setSaved("Coupon created.");
      setForm({ ...form, code: "", expiresAt: "", usageLimit: "" });
      await load();
    } catch {
      setError("We could not create this coupon. Check your connection and try again.");
    } finally {
      setWorking(false);
    }
  }

  async function toggle(coupon: Coupon) {
    setWorking(true);
    setError("");
    setSaved("");
    try {
      const response = await fetch("/api/providers/coupons", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: coupon.id, isActive: !coupon.isActive }) });
      const data = await responseJson<{ error?: string }>(response);
      if (!response.ok) {
        setError(data?.error ?? "We could not update this coupon.");
        return;
      }
      setSaved(coupon.isActive ? "Coupon paused." : "Coupon enabled.");
      await load();
    } catch {
      setError("We could not update this coupon. Check your connection and try again.");
    } finally {
      setWorking(false);
    }
  }

  async function removeCoupon() {
    if (!pendingDelete) return;
    const coupon = pendingDelete;
    setWorking(true);
    setError("");
    setSaved("");
    try {
      const response = await fetch("/api/providers/coupons", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: coupon.id }) });
      const data = await responseJson<{ error?: string }>(response);
      if (!response.ok) {
        setError(data?.error ?? "We could not delete this coupon.");
        return;
      }
      setPendingDelete(null);
      setSaved(`${coupon.code} was deleted.`);
      await load();
    } catch {
      setError("We could not delete this coupon. Check your connection and try again.");
    } finally {
      setWorking(false);
    }
  }

  const input = "w-full rounded-xl border border-[#183126]/15 bg-white px-3 py-3 text-sm outline-none focus:border-[#4d725d]";
  const selectButton = `${input} min-h-12 text-sm font-normal`;

  return (
    <section className="mt-8 rounded-[2rem] border border-[#183126]/10 bg-white p-6 shadow-[0_8px_32px_rgba(24,49,38,.06)] sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[.14em] text-[#718078]">Pro promotions</p>
      <h2 className="mt-2 text-2xl font-bold">Customer coupons</h2>
      <p className="mt-2 text-sm leading-6 text-[#687a70]">Provider-funded discounts reduce the service subtotal and the marketplace-fee basis. The separate $2.99 customer service fee does not change.</p>
      {!allowed ? (
        <div className="mt-5 rounded-2xl bg-[#f3f0d9] p-5 text-sm"><strong>Coupons require Pro.</strong> Starter providers keep packages, add-ons, consultations, recurring requests, and ordinary share links. <Link href="/provider/dashboard/billing" className="font-bold underline">View Pro</Link></div>
      ) : (
        <>
          <form onSubmit={create} className="mt-6 grid gap-4 overflow-visible rounded-2xl bg-[#f7f7f2] p-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-xs font-bold">Coupon code<input required pattern="[A-Za-z0-9_-]{3,32}" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") })} className={`${input} mt-1.5 uppercase`} placeholder="WELCOME10" /></label>
            <div className="text-xs font-bold">
              <span>Discount type</span>
              <CustomSelect ariaLabel="Discount type" value={form.discountType} options={discountOptions} onChange={(value) => setForm({ ...form, discountType: value as "percentage" | "fixed" })} className="mt-1.5" buttonClassName={selectButton} />
            </div>
            <label className="text-xs font-bold">{form.discountType === "percentage" ? "Percent off" : "Amount off ($)"}<input required type="number" min="1" max={form.discountType === "percentage" ? 100 : 1000000} step={form.discountType === "percentage" ? 1 : .01} value={form.discountValue} onChange={(event) => setForm({ ...form, discountValue: event.target.value })} className={`${input} mt-1.5`} /></label>
            <div className="text-xs font-bold">
              <span>Service</span>
              <CustomSelect ariaLabel="Coupon service" value={form.serviceId} options={serviceOptions} onChange={(value) => setForm({ ...form, serviceId: value })} className="mt-1.5" buttonClassName={selectButton} menuClassName="max-h-72 overflow-y-auto" />
            </div>
            <label className="text-xs font-bold">Minimum booking ($)<input type="number" min="0" step=".01" value={form.minimumSubtotal} onChange={(event) => setForm({ ...form, minimumSubtotal: event.target.value })} className={`${input} mt-1.5`} /></label>
            <label className="text-xs font-bold">Expiration date<input type="date" value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} className={`${input} mt-1.5`} /></label>
            <label className="text-xs font-bold">Usage limit<input type="number" min="1" value={form.usageLimit} onChange={(event) => setForm({ ...form, usageLimit: event.target.value })} className={`${input} mt-1.5`} placeholder="No limit" /></label>
            <div className="flex flex-col justify-end gap-2 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.firstBookingOnly} onChange={(event) => setForm({ ...form, firstBookingOnly: event.target.checked, repeatCustomerOnly: event.target.checked ? false : form.repeatCustomerOnly })} />First booking only</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.repeatCustomerOnly} onChange={(event) => setForm({ ...form, repeatCustomerOnly: event.target.checked, firstBookingOnly: event.target.checked ? false : form.firstBookingOnly })} />Returning customers only</label>
            </div>
            <button disabled={working} className="min-h-11 w-fit self-end justify-self-end rounded-full bg-[#eee25a] px-5 py-2.5 text-sm font-bold transition hover:bg-[#e4d746] disabled:opacity-50 sm:col-start-2 lg:col-start-3">{working ? "Creating…" : "Create coupon"}</button>
          </form>
          {error && <p role="alert" className="mt-4 rounded-xl bg-[#fff1e8] p-3 text-sm font-bold text-[#9a4e25]">{error}</p>}
          {saved && <p role="status" className="mt-4 rounded-xl bg-[#e6f1e5] p-3 text-sm font-bold text-[#34704a]">{saved}</p>}
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {loading ? <p className="text-sm text-[#718078]">Loading coupons…</p> : coupons.length ? coupons.map((coupon) => (
              <article key={coupon.id} className="rounded-2xl border border-[#183126]/10 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-lg font-bold">{coupon.code}</p>
                    <p className="mt-1 text-sm text-[#52665b]">{coupon.discountType === "percentage" ? `${coupon.discountValue}% off` : `$${(coupon.discountValue / 100).toFixed(2)} off`} · {coupon.serviceTitle ?? "All services"}</p>
                    <p className="mt-2 text-xs text-[#718078]">{coupon.redemptionCount}{coupon.usageLimit ? ` / ${coupon.usageLimit}` : ""} uses{coupon.expiresOn ? ` · Ends ${coupon.expiresOn}` : ""}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase ${coupon.isActive ? "bg-[#e6f1e5] text-[#34704a]" : "bg-[#ecece7] text-[#718078]"}`}>{coupon.isActive ? "Active" : "Paused"}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" disabled={working} onClick={() => void toggle(coupon)} className="rounded-full border border-[#183126]/15 px-4 py-2 text-xs font-bold transition hover:bg-[#edf2eb] disabled:opacity-50">{coupon.isActive ? "Pause" : "Enable"}</button>
                  <button type="button" disabled={working} onClick={() => { setError(""); setPendingDelete(coupon); }} className="rounded-full border border-[#b85f4c]/25 px-4 py-2 text-xs font-bold text-[#9a4e3c] transition hover:bg-[#fff0eb] disabled:opacity-50">Delete</button>
                </div>
              </article>
            )) : <p className="text-sm text-[#718078]">No coupons yet.</p>}
          </div>
        </>
      )}

      {pendingDelete && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-[#10251c]/55 p-5" role="dialog" aria-modal="true" aria-labelledby="delete-coupon-title" onPointerDown={(event) => { if (event.currentTarget === event.target && !working) setPendingDelete(null); }}>
          <div className="w-full max-w-md rounded-[2rem] bg-white p-6 text-[#183126] shadow-2xl sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[.14em] text-[#9a4e3c]">Delete coupon</p>
            <h3 id="delete-coupon-title" className="mt-2 text-2xl font-bold">Delete {pendingDelete.code}?</h3>
            <p className="mt-3 text-sm leading-6 text-[#687970]">Customers will no longer be able to use this code. Past bookings keep their recorded discount details.</p>
            {error && <p role="alert" className="mt-4 rounded-xl bg-[#fff1e8] p-3 text-sm font-bold text-[#9a4e25]">{error}</p>}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button type="button" disabled={working} onClick={() => setPendingDelete(null)} className="rounded-full px-5 py-3 text-sm font-bold transition hover:bg-[#edf1ec] disabled:opacity-50">Cancel</button>
              <button type="button" disabled={working} onClick={() => void removeCoupon()} className="rounded-full bg-[#9a4e3c] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#7f3e30] disabled:opacity-50">{working ? "Deleting…" : "Delete coupon"}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
