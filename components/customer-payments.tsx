"use client";

import { useEffect, useState } from "react";

type PaymentMethod = { id: string; brand: string; last4: string; expMonth: number | null; expYear: number | null };
type PaymentMethodResponse = { configured?: boolean; mode?: "test" | "live"; paymentMethods?: PaymentMethod[]; error?: string };

export default function CustomerPayments() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [configured, setConfigured] = useState(true);
  const [mode, setMode] = useState<"test" | "live">("test");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/stripe/payment-methods", { cache: "no-store" })
      .then(async (response) => ({ response, data: await response.json() as PaymentMethodResponse }))
      .catch(() => null)
      .then((result) => {
        if (!active) return;
        if (!result?.response.ok) setError(result?.data.error ?? "We could not load your payment methods.");
        else {
          setMethods(result.data.paymentMethods ?? []);
          setConfigured(result.data.configured !== false);
          setMode(result.data.mode ?? "test");
        }
        const setup = new URLSearchParams(window.location.search).get("setup");
        if (setup === "success") setNotice("Your payment method was added securely.");
        if (setup === "cancelled") setNotice("Payment setup was cancelled. Nothing was charged.");
        setLoaded(true);
      });
    return () => { active = false; };
  }, []);

  async function addPaymentMethod() {
    setBusy("add");
    setError("");
    const response = await fetch("/api/stripe/payment-methods", { method: "POST" }).catch(() => null);
    const data = response ? await response.json() as { url?: string; error?: string } : null;
    if (!response?.ok || !data?.url) {
      setError(data?.error ?? "We could not open Stripe payment setup.");
      setBusy("");
      return;
    }
    window.location.assign(data.url);
  }

  async function removePaymentMethod(method: PaymentMethod) {
    if (!window.confirm(`Remove ${method.brand} ending in ${method.last4}?`)) return;
    setBusy(method.id);
    setError("");
    const response = await fetch("/api/stripe/payment-methods", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentMethodId: method.id }),
    }).catch(() => null);
    const data = response ? await response.json() as { error?: string } : null;
    if (!response?.ok) setError(data?.error ?? "We could not remove that payment method.");
    else {
      setMethods((current) => current.filter((item) => item.id !== method.id));
      setNotice("Payment method removed.");
    }
    setBusy("");
  }

  return <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold text-[#687a70]">Customer account</p><h1 className="mt-1 text-3xl font-bold tracking-[-.04em] sm:text-4xl">Payments</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#687a70]">Save a card for faster booking checkout or remove one you no longer use.</p></div><span className={`w-fit rounded-full px-4 py-2 text-xs font-bold ${mode === "live" ? "bg-[#e5f1e5] text-[#34704a]" : "bg-[#fff3c4] text-[#775f00]"}`}>{mode === "live" ? "Live payments" : "Test mode"}</span></div>
    {notice && <p role="status" className="mt-6 rounded-2xl bg-[#e5f1e5] p-4 text-sm font-bold text-[#34704a]">✓ {notice}</p>}
    {error && <p role="alert" className="mt-6 rounded-2xl bg-[#fff0e8] p-4 text-sm font-bold text-[#964f2c]">{error}</p>}
    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="rounded-[2rem] border border-[#183126]/10 bg-white p-6 sm:p-8"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-xl font-bold">Saved payment methods</h2><p className="mt-1 text-sm text-[#738179]">Cards are stored securely by Stripe.</p></div><button disabled={Boolean(busy) || !configured} onClick={() => void addPaymentMethod()} className="rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#315846] disabled:opacity-50">{busy === "add" ? "Opening Stripe…" : "+ Add payment method"}</button></div>
        {!loaded ? <div className="mt-6 h-24 animate-pulse rounded-2xl bg-[#f3f4ef]" /> : methods.length ? <div className="mt-6 space-y-3">{methods.map((method) => <article key={method.id} className="flex flex-col justify-between gap-4 rounded-2xl border border-[#183126]/10 bg-[#fafaf6] p-5 sm:flex-row sm:items-center"><div className="flex items-center gap-4"><span className="grid h-12 w-16 place-items-center rounded-xl bg-white text-xs font-black uppercase shadow-sm">{method.brand}</span><div><p className="font-bold capitalize">{method.brand} •••• {method.last4}</p><p className="mt-1 text-xs text-[#718078]">Expires {String(method.expMonth ?? "").padStart(2, "0")}/{method.expYear ?? ""}</p></div></div><button disabled={Boolean(busy)} onClick={() => void removePaymentMethod(method)} className="self-start rounded-full bg-[#fff0e8] px-4 py-2 text-xs font-bold text-[#964f2c] transition hover:bg-[#f8d9ca] disabled:opacity-50 sm:self-auto">{busy === method.id ? "Removing…" : "Remove"}</button></article>)}</div> : <div className="mt-6 rounded-2xl bg-[#f5f5ef] p-8 text-center"><span className="text-3xl">💳</span><h3 className="mt-3 font-bold">No saved cards yet</h3><p className="mt-2 text-sm text-[#738179]">Add one now, or enter a card when you pay for a confirmed booking.</p></div>}
        {!configured && <p className="mt-5 rounded-2xl bg-[#fff3c4] p-4 text-xs font-semibold text-[#775f00]">Secure card setup will be available after the BubsBookings administrator finishes Stripe configuration.</p>}
      </section>
      <aside className="rounded-[2rem] bg-[#183126] p-6 text-white"><span className="text-3xl">🔒</span><h2 className="mt-4 text-xl font-bold">Your card details stay with Stripe</h2><p className="mt-3 text-sm leading-6 text-[#b7c6be]">BubsBookings never receives your full card number or security code. Adding a card does not charge it. You approve every booking payment in Stripe Checkout.</p><div className="mt-5 rounded-2xl bg-white/10 p-4 text-xs leading-5 text-[#d5dfd9]">Refunds are returned to the original payment method used for that booking, even if you later remove the card here.</div></aside>
    </div>
  </div>;
}
