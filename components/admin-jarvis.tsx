"use client";

import { useEffect, useRef, useState } from "react";

type Incident = { key: string; severity: "critical" | "high" | "medium"; title: string; evidence: string };
type Message = { id: string; role: "admin" | "jarvis"; text: string; incidents?: Incident[]; generatedAt?: string };
type PhoneSettings = { outboundAlertsEnabled: boolean; minimumSeverity: "critical" | "high"; quietHoursStart: number; quietHoursEnd: number; timeZone: string };
type PhoneStatus = { inboundConfigured: boolean; outboundConfigured: boolean; alertPhone: string; maxOutboundCallsPerDay: number; settings: PhoneSettings };

type SpeechRecognitionEventLike = { results: ArrayLike<{ 0: { transcript: string } }> };
type SpeechRecognitionErrorLike = { error?: string };
type SpeechRecognitionLike = {
  continuous: boolean; interimResults: boolean; lang: string;
  start(): void; stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function speechRecognitionConstructor() {
  if (typeof window === "undefined") return null;
  const browserWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition ?? null;
}

export default function AdminJarvis() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const [phone, setPhone] = useState<PhoneStatus | null>(null);
  const [phoneCode, setPhoneCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [phoneBusy, setPhoneBusy] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    fetch("/api/admin/jarvis", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<{ configured?: boolean }> : null)
      .then((payload) => setConfigured(Boolean(payload?.configured)))
      .catch(() => setConfigured(false));
    fetch("/api/admin/jarvis/phone", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<PhoneStatus> : null)
      .then((payload) => setPhone(payload))
      .catch(() => setPhone(null));
    return () => recognitionRef.current?.stop();
  }, []);

  async function submitQuestion(event: React.FormEvent) {
    event.preventDefault();
    const cleanQuestion = question.trim();
    if (busy || cleanQuestion.length < 2) return;
    setBusy(true);
    setError("");
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "admin", text: cleanQuestion }]);
    setQuestion("");
    try {
      const response = await fetch("/api/admin/jarvis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: cleanQuestion }),
      });
      const contentType = response.headers.get("content-type") ?? "";
      const payload = contentType.includes("application/json")
        ? await response.json() as { answer?: string; error?: string; incidents?: Incident[]; generatedAt?: string }
        : null;
      if (!response.ok || !payload?.answer) throw new Error(payload?.error || "Jarvis returned an unexpected response.");
      setMessages((current) => [...current, {
        id: crypto.randomUUID(), role: "jarvis", text: payload.answer!, incidents: payload.incidents, generatedAt: payload.generatedAt,
      }]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Jarvis could not answer right now.");
    } finally {
      setBusy(false);
    }
  }

  function toggleListening() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Recognition = speechRecognitionConstructor();
    if (!Recognition) {
      setError("Voice input is not supported by this browser. You can still type your question.");
      return;
    }
    setError("");
    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) setQuestion((current) => current ? `${current} ${transcript}` : transcript);
    };
    recognition.onerror = (event) => setError(event.error === "not-allowed" ? "Microphone access was not allowed." : "Voice input could not be completed.");
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  function speak(text: string) {
    if (!("speechSynthesis" in window)) {
      setError("Spoken answers are not supported by this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }

  async function createPhoneCode() {
    setPhoneBusy(true); setError(""); setPhoneCode(null);
    try {
      const response = await fetch("/api/admin/jarvis/phone", { method: "POST" });
      const payload = response.headers.get("content-type")?.includes("application/json") ? await response.json() as { code?: string; expiresAt?: string; error?: string } : null;
      if (!response.ok || !payload?.code || !payload.expiresAt) throw new Error(payload?.error || "A phone access code could not be created.");
      setPhoneCode({ code: payload.code, expiresAt: payload.expiresAt });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "A phone access code could not be created.");
    } finally { setPhoneBusy(false); }
  }

  async function savePhoneSettings(settings: PhoneSettings) {
    setPhoneBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/jarvis/phone", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
      const payload = response.headers.get("content-type")?.includes("application/json") ? await response.json() as { settings?: PhoneSettings; error?: string } : null;
      if (!response.ok || !payload?.settings) throw new Error(payload?.error || "Phone settings could not be saved.");
      setPhone((current) => current ? { ...current, settings: payload.settings! } : current);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Phone settings could not be saved.");
    } finally { setPhoneBusy(false); }
  }

  return <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
    <section className="min-w-0 rounded-[2rem] border border-[#183126]/10 bg-white p-5 shadow-sm sm:p-7" aria-label="Jarvis chat">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#183126]/10 pb-5">
        <div><h2 className="text-xl font-bold">Operations chat</h2><p className="mt-1 text-sm text-[#718078]">Aggregate metrics only. Each request is authorized and audited.</p></div>
        <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${configured ? "bg-[#e4efdf] text-[#285b3b]" : configured === false ? "bg-[#fff0e7] text-[#8c421e]" : "bg-[#f2f2ec] text-[#65736c]"}`}>{configured === null ? "Checking setup" : configured ? "Ready" : "Setup required"}</span>
      </div>

      <div className="mt-5 min-h-80 space-y-4" aria-live="polite">
        {messages.length === 0 && <div className="rounded-3xl bg-[#f5f6f1] p-6"><p className="font-bold">Try asking:</p><ul className="mt-3 space-y-2 text-sm leading-6 text-[#52665b]"><li>Are there any critical operational incidents?</li><li>How many active providers and listings do we have?</li><li>Do any payouts or Stripe webhooks need attention?</li><li>What happened with bookings in the last 24 hours?</li></ul></div>}
        {messages.map((message) => <article key={message.id} className={`rounded-3xl p-5 ${message.role === "admin" ? "ml-auto max-w-[88%] bg-[#183126] text-white" : "mr-auto max-w-[94%] bg-[#eef3ea] text-[#183126]"}`}>
          <p className="text-xs font-bold uppercase tracking-[.12em] opacity-70">{message.role === "admin" ? "You" : "Jarvis"}</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{message.text}</p>
          {message.incidents && message.incidents.length > 0 && <div className="mt-4 space-y-2 border-t border-[#183126]/10 pt-4">{message.incidents.map((incident) => <div key={incident.key} className="rounded-2xl bg-white/70 p-3"><p className="text-xs font-bold uppercase tracking-wide text-[#9a4e25]">{incident.severity}</p><p className="mt-1 text-sm font-bold">{incident.title}</p><p className="mt-1 text-xs leading-5 text-[#64756c]">{incident.evidence}</p></div>)}</div>}
          {message.role === "jarvis" && <div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" onClick={() => speak(message.text)} className="rounded-full border border-[#183126]/15 bg-white px-3 py-2 text-xs font-bold hover:bg-[#eee25a]">Read aloud</button>{message.generatedAt && <span className="text-[11px] text-[#718078]">Snapshot {new Date(message.generatedAt).toLocaleString()}</span>}</div>}
        </article>)}
        {busy && <div className="mr-auto rounded-3xl bg-[#eef3ea] px-5 py-4 text-sm font-semibold">Jarvis is checking current operations...</div>}
      </div>

      {error && <p role="alert" className="mt-4 rounded-2xl border border-[#d88e69]/30 bg-[#fff0e7] px-4 py-3 text-sm font-semibold text-[#8c421e]">{error}</p>}
      <form onSubmit={submitQuestion} className="mt-5 border-t border-[#183126]/10 pt-5">
        <label htmlFor="jarvis-question" className="text-sm font-bold">Ask Jarvis</label><p className="mt-1 text-xs text-[#718078]">Do not enter names, emails, phone numbers, addresses, card numbers, or other private information.</p>
        <textarea id="jarvis-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={1_000} rows={3} placeholder="Ask about bookings, payments, payouts, traffic, support, or system health" className="mt-2 w-full resize-y rounded-2xl border border-[#183126]/15 bg-white px-4 py-3 text-sm outline-none focus:border-[#183126] focus:ring-4 focus:ring-[#eee25a]/50" />
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center"><button type="button" onClick={toggleListening} aria-pressed={listening} className={`min-h-11 rounded-full border px-5 py-2.5 text-sm font-bold ${listening ? "border-[#9a4e25] bg-[#fff0e7] text-[#8c421e]" : "border-[#183126]/15 hover:bg-[#eef3ea]"}`}>{listening ? "Stop listening" : "Use microphone"}</button><button type="submit" disabled={busy || question.trim().length < 2 || configured === false} className="min-h-11 rounded-full bg-[#183126] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#315846] disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Checking..." : "Ask Jarvis"}</button><span className="text-xs text-[#718078] sm:ml-auto">{question.length}/1,000</span></div>
      </form>
    </section>

    <aside className="space-y-4">
      <section className="rounded-[1.7rem] bg-[#183126] p-5 text-white"><p className="text-xs font-bold uppercase tracking-[.14em] text-white/60">Safety boundary</p><h2 className="mt-2 text-xl font-bold">Read only by design</h2><p className="mt-3 text-sm leading-6 text-white/75">Jarvis receives aggregate counts, not customer names, emails, messages, addresses, payment details, or secrets.</p></section>
      <section className="rounded-[1.7rem] border border-[#183126]/10 bg-white p-5"><h2 className="font-bold">Jarvis cannot</h2><ul className="mt-3 space-y-2 text-sm leading-5 text-[#64756c]"><li>Deploy or change code</li><li>Move money or issue refunds</li><li>Suspend or edit accounts</li><li>Send messages or alerts</li><li>Reveal private customer data</li></ul></section>
      <section className="rounded-[1.7rem] border border-[#d9ca55] bg-[#fff8cf] p-5"><h2 className="font-bold">Voice privacy</h2><p className="mt-2 text-sm leading-6 text-[#685d27]">Voice input uses the browser&apos;s speech-recognition support. Review the transcript before sending. Spoken answers only start when you select Read aloud.</p></section>
      <section className="rounded-[1.7rem] border border-[#183126]/10 bg-white p-5"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#718078]">Jarvis phone</p><h2 className="mt-2 text-lg font-bold">Call securely</h2><p className="mt-2 text-sm leading-6 text-[#64756c]">Generate a one-time code while signed in, then enter it when Jarvis answers. Each code expires after 10 minutes.</p><button type="button" disabled={phoneBusy || !phone?.inboundConfigured} onClick={createPhoneCode} className="mt-4 min-h-11 w-full rounded-full bg-[#183126] px-4 py-2 text-sm font-bold text-white hover:bg-[#315846] disabled:cursor-not-allowed disabled:opacity-50">{phoneBusy ? "Working..." : "Generate phone code"}</button>{phoneCode && <div className="mt-4 rounded-2xl bg-[#eef3ea] p-4 text-center"><p className="text-xs font-bold uppercase tracking-wide text-[#64756c]">One-time code</p><p className="mt-1 font-mono text-3xl font-bold tracking-[.18em]">{phoneCode.code}</p><p className="mt-2 text-xs text-[#64756c]">Expires {new Date(phoneCode.expiresAt).toLocaleTimeString()}</p></div>}{phone && !phone.inboundConfigured && <p className="mt-3 text-xs font-semibold text-[#9a4e25]">Twilio and OpenAI phone settings are still required on the server.</p>}</section>
      <section className="rounded-[1.7rem] border border-[#183126]/10 bg-white p-5"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#718078]">Incident calls</p><h2 className="mt-2 text-lg font-bold">Outbound alerts</h2><p className="mt-2 text-sm leading-6 text-[#64756c]">Calls {phone?.alertPhone ?? "not configured"}. Quiet hours are 9 PM to 7 AM Pacific. A hard limit of {phone?.maxOutboundCallsPerDay ?? 10} calls per day applies.</p><label className="mt-4 flex items-center gap-3 text-sm font-bold"><input type="checkbox" checked={phone?.settings.outboundAlertsEnabled ?? false} disabled={phoneBusy || !phone?.outboundConfigured} onChange={(event) => phone && savePhoneSettings({ ...phone.settings, outboundAlertsEnabled: event.target.checked })} className="h-5 w-5 accent-[#183126]"/>Call me for critical incidents</label>{phone?.settings.outboundAlertsEnabled && <button type="button" disabled={phoneBusy} onClick={() => savePhoneSettings({ ...phone.settings, outboundAlertsEnabled: false })} className="mt-3 text-xs font-bold underline underline-offset-4">Turn off incident calls</button>}</section>
    </aside>
  </div>;
}
