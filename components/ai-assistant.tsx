"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";

type ChatMessage = { role: "user" | "assistant"; content: string };

export default function AiAssistant() {
  const [eligible, setEligible] = useState(false); const [configured, setConfigured] = useState(false); const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", content: "Hi! I’m BookMe AI. Ask me how to manage listings, bookings, teams, reports, or account settings." }]);
  const [input, setInput] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { fetch("/api/assistant", { cache: "no-store" }).then(async (response) => response.ok ? response.json() as Promise<{ eligible?: boolean; configured?: boolean }> : null).then((data) => { setEligible(Boolean(data?.eligible)); setConfigured(Boolean(data?.configured)); }).catch(() => null); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);
  if (!eligible) return null;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const message = input.trim(); if (!message || busy) return;
    const next = [...messages, { role: "user" as const, content: message }]; setMessages(next); setInput(""); setBusy(true); setError("");
    const response = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, history: messages.slice(1) }) }).catch(() => null);
    const data = response ? await response.json() as { answer?: string; error?: string } : null; setBusy(false);
    if (!response?.ok || !data?.answer) { setError(data?.error ?? "BookMe AI could not answer right now."); return; }
    setMessages((current) => [...current, { role: "assistant", content: data.answer! }]);
  }
  return <div className="fixed bottom-5 right-5 z-[80] text-[#183126]">{open && <section className="mb-3 flex h-[520px] w-[min(380px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-[2rem] border border-[#183126]/10 bg-white shadow-2xl"><header className="flex items-center justify-between bg-[#183126] px-5 py-4 text-white"><div><p className="font-bold">BookMe AI</p><p className="text-[10px] text-white/60">Included with your paid plan</p></div><button onClick={() => setOpen(false)} aria-label="Close BookMe AI" className="rounded-full px-2 py-1 hover:bg-white/15">×</button></header><div className="flex-1 space-y-3 overflow-y-auto bg-[#fafaf6] p-4">{messages.map((item, index) => <div key={index} className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`}><p className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-5 ${item.role === "user" ? "rounded-br-md bg-[#183126] text-white" : "rounded-bl-md border border-[#183126]/10 bg-white"}`}>{item.content}</p></div>)}{busy && <p className="w-fit rounded-2xl bg-white px-4 py-3 text-sm text-[#718078]">Thinking…</p>}<div ref={endRef} /></div><form onSubmit={submit} className="border-t border-[#183126]/10 p-4">{!configured && <p className="mb-2 rounded-xl bg-[#fff4bf] p-2 text-xs font-bold">The AI connection still needs its server key.</p>}{error && <p className="mb-2 rounded-xl bg-[#fff0e8] p-2 text-xs font-bold text-[#964f2c]">{error}</p>}<div className="flex gap-2"><input value={input} onChange={(event) => setInput(event.target.value)} maxLength={1000} placeholder="Ask BookMe AI…" className="min-w-0 flex-1 rounded-full border border-[#183126]/15 px-4 py-2.5 text-sm outline-none" /><button disabled={busy || !input.trim()} className="rounded-full bg-[#eee25a] px-4 py-2.5 text-sm font-bold disabled:opacity-50">Send</button></div><p className="mt-2 text-center text-[9px] text-[#849087]">Powered by OpenAI. AI can make mistakes. Don’t share sensitive information. <Link href="/ai-transparency" className="underline">Learn more</Link></p></form></section>}<button onClick={() => setOpen((value) => !value)} className="ml-auto flex items-center gap-2 rounded-full bg-[#183126] px-5 py-3 font-bold text-white shadow-xl transition hover:bg-[#315846]"><span className="text-[#eee25a]">✦</span>{open ? "Close" : "AI help"}</button></div>;
}
