"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

type Conversation = {
  id: string; providerId: string; providerName: string; customerName: string;
  serviceTitle: string | null; lastMessage: string | null; lastMessageAt: string | null;
  unreadCount: number; isProvider: boolean;
};
type Message = { id: string; body: string; isMine: boolean; senderName: string; createdAt: string; deleted: boolean };
type MessageData = { conversations: Conversation[]; selectedConversation: Conversation | null; messages: Message[] };

export default function MessagingCenter({
  mode,
  initialConversationId = "",
  initialProviderId = "",
  initialServiceId = "",
  initialProviderName = "",
  initialServiceTitle = "",
}: {
  mode: "customer" | "provider";
  initialConversationId?: string;
  initialProviderId?: string;
  initialServiceId?: string;
  initialProviderName?: string;
  initialServiceTitle?: string;
}) {
  const [data, setData] = useState<MessageData>({ conversations: [], selectedConversation: null, messages: [] });
  const [selectedId, setSelectedId] = useState(initialConversationId);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportCategory, setReportCategory] = useState("harassment");
  const [reportDetails, setReportDetails] = useState("");
  const [reporting, setReporting] = useState(false);
  const [reportNotice, setReportNotice] = useState("");
  const messageEndRef = useRef<HTMLDivElement>(null);
  const selectedIdRef = useRef(initialConversationId);

  const loadMessages = useCallback(async (conversationId = selectedIdRef.current) => {
    const query = conversationId ? `?conversationId=${encodeURIComponent(conversationId)}` : "";
    const response = await fetch(`/api/messages${query}`, { cache: "no-store" }).catch(() => null);
    if (!response?.ok) {
      setError("We could not load your messages.");
      setLoading(false);
      return;
    }
    const nextData = await response.json() as MessageData;
    setData(nextData);
    const resolvedId = nextData.selectedConversation?.id ?? conversationId;
    if (resolvedId) {
      selectedIdRef.current = resolvedId;
      setSelectedId(resolvedId);
    }
    setLoading(false);
    if (resolvedId) {
      await fetch("/api/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: resolvedId }),
      }).catch(() => null);
      setData((current) => ({
        ...current,
        conversations: current.conversations.map((conversation) => conversation.id === resolvedId ? { ...conversation, unreadCount: 0 } : conversation),
      }));
    }
  }, []);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => { void loadMessages(initialConversationId); }, 0);
    const refreshTimer = window.setInterval(() => { void loadMessages(); }, 15_000);
    return () => { window.clearTimeout(initialTimer); window.clearInterval(refreshTimer); };
  }, [initialConversationId, loadMessages]);

  useEffect(() => { messageEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [data.messages]);

  async function chooseConversation(conversationId: string) {
    selectedIdRef.current = conversationId;
    setSelectedId(conversationId);
    setLoading(true);
    await loadMessages(conversationId);
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const trimmedMessage = message.trim();
    if (!trimmedMessage || sending) return;
    setSending(true);
    setError("");
    const response = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(selectedId
        ? { conversationId: selectedId, message: trimmedMessage }
        : { providerId: initialProviderId, serviceId: initialServiceId, message: trimmedMessage }),
    }).catch(() => null);
    const result = response ? await response.json() as { conversationId?: string; error?: string } : null;
    if (!response?.ok || !result?.conversationId) {
      setError(result?.error ?? "We could not send your message. Please try again.");
      setSending(false);
      return;
    }
    setMessage("");
    selectedIdRef.current = result.conversationId;
    setSelectedId(result.conversationId);
    await loadMessages(result.conversationId);
    setSending(false);
  }

  async function deleteMessage(messageId: string) {
    if (!window.confirm("Delete this message? The chat will show that a message was deleted.")) return;
    setError("");
    const response = await fetch("/api/messages", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId }),
    }).catch(() => null);
    const result = response ? await response.json() as { error?: string } : null;
    if (!response?.ok) {
      setError(result?.error ?? "We could not delete that message.");
      return;
    }
    setData((current) => ({
      ...current,
      messages: current.messages.map((item) => item.id === messageId ? { ...item, body: "Message deleted", deleted: true } : item),
    }));
  }

  async function deleteConversation() {
    if (!selectedId || !window.confirm("Remove this entire conversation from your inbox? This will not erase it for the other person.")) return;
    setError("");
    const response = await fetch("/api/messages", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: selectedId }),
    }).catch(() => null);
    const result = response ? await response.json() as { error?: string } : null;
    if (!response?.ok) {
      setError(result?.error ?? "We could not remove that conversation.");
      return;
    }
    const remaining = data.conversations.filter((conversation) => conversation.id !== selectedId);
    const nextId = remaining[0]?.id ?? "";
    selectedIdRef.current = nextId;
    setSelectedId(nextId);
    setData((current) => ({ ...current, conversations: remaining, selectedConversation: null, messages: [] }));
    if (nextId) await loadMessages(nextId);
  }

  async function submitReport(event: FormEvent) {
    event.preventDefault();
    if (!selectedId || reporting) return;
    setReporting(true);
    setError("");
    const response = await fetch("/api/safety-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: selectedId, category: reportCategory, details: reportDetails }),
    }).catch(() => null);
    const result = response ? await response.json() as { error?: string } : null;
    setReporting(false);
    if (!response?.ok) {
      setError(result?.error ?? "We could not submit your report.");
      return;
    }
    setReportOpen(false);
    setReportDetails("");
    setReportNotice("Your safety report was submitted for review.");
  }

  const selected = data.selectedConversation;
  const contactName = selected ? (mode === "provider" ? selected.customerName : selected.providerName) : initialProviderName;
  const serviceTitle = selected?.serviceTitle ?? initialServiceTitle;
  const canStartConversation = mode === "customer" && Boolean(initialProviderId);

  return (
    <section className="overflow-hidden rounded-[2rem] border border-[#183126]/10 bg-white shadow-[0_8px_30px_rgba(24,49,38,.06)]">
      <div className="grid min-h-[620px] lg:grid-cols-[300px_1fr]">
        <aside className="border-b border-[#183126]/10 bg-[#f7f7f2] lg:border-b-0 lg:border-r">
          <div className="border-b border-[#183126]/10 p-5"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#718078]">Inbox</p><h2 className="mt-2 text-2xl font-bold">Messages</h2></div>
          <div className="max-h-64 overflow-y-auto lg:max-h-[540px]">
            {loading && data.conversations.length === 0 ? <p className="p-5 text-sm text-[#718078]">Loading conversations…</p> : data.conversations.length === 0 ? <div className="p-6 text-center"><p className="text-3xl">✉</p><p className="mt-3 font-bold">No conversations yet</p><p className="mt-1 text-sm leading-6 text-[#718078]">{mode === "provider" ? "Customer questions will appear here." : "Contact a provider from one of their listings."}</p></div> : data.conversations.map((conversation) => {
              const name = mode === "provider" ? conversation.customerName : conversation.providerName;
              const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
              return <button key={conversation.id} type="button" onClick={() => chooseConversation(conversation.id)} className={`flex w-full gap-3 border-b border-[#183126]/8 p-4 text-left transition hover:bg-[#e7eee2] ${selectedId === conversation.id ? "bg-[#e7eee2]" : ""}`}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#183126] text-xs font-bold text-[#eee25a]">{initials}</span><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-bold">{name}</span>{conversation.unreadCount > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#eee25a] px-1 text-[10px] font-bold">{conversation.unreadCount}</span>}</span><span className="mt-1 block truncate text-xs text-[#728179]">{conversation.lastMessage ?? conversation.serviceTitle ?? "New conversation"}</span></span></button>;
            })}
          </div>
        </aside>

        <div className="flex min-h-[480px] flex-col">
          {(selected || canStartConversation) ? <>
            <div className="flex items-center justify-between gap-4 border-b border-[#183126]/10 px-5 py-4"><div><p className="font-bold">{contactName}</p>{serviceTitle && <p className="mt-1 text-xs text-[#728179]">About {serviceTitle}</p>}</div>{selected && <div className="flex items-center gap-1"><button type="button" onClick={() => { setReportNotice(""); setReportOpen(true); }} className="rounded-full px-3 py-2 text-xs font-bold text-[#7a681d] transition hover:bg-[#fff3b0]">Report</button><button type="button" onClick={deleteConversation} className="rounded-full px-3 py-2 text-xs font-bold text-[#8a4c3a] transition hover:bg-[#f4d8cc]">Delete conversation</button></div>}</div>
            <div className="flex-1 space-y-4 overflow-y-auto bg-[#fcfcf8] p-5 sm:p-7">
              {!selected && <div className="mx-auto max-w-sm rounded-2xl bg-[#edf2e9] p-4 text-center text-sm leading-6 text-[#5e7067]">Ask about availability, pricing, or anything you want to know before booking.</div>}
              {data.messages.map((item) => <div key={item.id} className={`flex ${item.isMine ? "justify-end" : "justify-start"}`}><div className={`group max-w-[82%] rounded-2xl px-4 py-3 ${item.isMine ? "rounded-br-md bg-[#183126] text-white" : "rounded-bl-md border border-[#183126]/10 bg-white"}`}><p className={`whitespace-pre-wrap break-words text-sm leading-6 ${item.deleted ? "italic opacity-60" : ""}`}>{item.body}</p><div className="mt-1.5 flex items-center justify-between gap-4"><p className={`text-[10px] ${item.isMine ? "text-white/55" : "text-[#8a9690]"}`}>{new Date(item.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>{item.isMine && !item.deleted && <button type="button" onClick={() => deleteMessage(item.id)} className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white/55 opacity-0 transition hover:bg-white/15 hover:text-white group-hover:opacity-100 focus:opacity-100">Delete</button>}</div></div></div>)}
              <div ref={messageEndRef} />
            </div>
            <form onSubmit={sendMessage} className="border-t border-[#183126]/10 bg-white p-4 sm:p-5">
              {error && <p role="alert" className="mb-3 rounded-xl bg-[#fff0e8] px-3 py-2 text-xs font-semibold text-[#964f2c]">{error}</p>}{reportNotice && <p role="status" className="mb-3 rounded-xl bg-[#e4f1e5] px-3 py-2 text-xs font-semibold text-[#35704a]">{reportNotice}</p>}
              <div className="flex items-end gap-3"><label className="sr-only" htmlFor="message-body">Message</label><textarea id="message-body" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={2000} rows={2} placeholder={`Message ${contactName || "provider"}…`} className="min-h-12 flex-1 resize-none rounded-2xl border border-[#183126]/15 bg-[#fafaf6] px-4 py-3 text-sm outline-none transition focus:border-[#6f7f4c] focus:ring-2 focus:ring-[#eee25a]/50" /><button type="submit" disabled={!message.trim() || sending} className="rounded-full bg-[#eee25a] px-5 py-3 text-sm font-bold text-[#183126] transition hover:bg-[#e1d43d] disabled:cursor-not-allowed disabled:opacity-50">{sending ? "Sending…" : "Send"}</button></div><p className="mt-2 text-[10px] leading-4 text-[#859088]">Messages are automatically checked for unsafe or unprofessional content. <Link href="/ai-transparency" className="font-bold underline">How it works</Link></p>
            </form>
          </> : <div className="grid flex-1 place-items-center p-8 text-center"><div><p className="text-5xl">💬</p><h2 className="mt-4 text-xl font-bold">Choose a conversation</h2><p className="mt-2 text-sm text-[#718078]">Select someone from your inbox to read and reply.</p></div></div>}
        </div>
      </div>
      {reportOpen && <div className="fixed inset-0 z-[90] grid place-items-center bg-[#10251c]/55 p-5" role="dialog" aria-modal="true" aria-labelledby="report-title"><form onSubmit={submitReport} className="w-full max-w-lg rounded-[2rem] bg-white p-6 shadow-2xl sm:p-8"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#718078]">Trust and safety</p><h2 id="report-title" className="mt-2 text-2xl font-bold">Report this conversation</h2><p className="mt-2 text-sm leading-6 text-[#687970]">Tell BubsBookings what happened. Reporting does not automatically delete the conversation or notify the other person.</p><label htmlFor="report-category" className="mt-5 block text-sm font-bold">Reason</label><select id="report-category" value={reportCategory} onChange={(event) => setReportCategory(event.target.value)} className="mt-2 w-full rounded-2xl border border-[#183126]/15 bg-[#fafaf6] px-4 py-3 text-sm outline-none"><option value="harassment">Harassment or abusive behavior</option><option value="spam">Spam or scam</option><option value="unsafe">Threat or unsafe situation</option><option value="other">Something else</option></select><label htmlFor="report-details" className="mt-5 block text-sm font-bold">What happened?</label><textarea id="report-details" required minLength={10} value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} maxLength={1000} rows={4} className="mt-2 w-full resize-none rounded-2xl border border-[#183126]/15 bg-[#fafaf6] px-4 py-3 text-sm outline-none focus:border-[#6f7f4c]" placeholder="Give a clear reason for this report. Don’t include passwords or payment information." /><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setReportOpen(false)} className="rounded-full px-5 py-3 text-sm font-bold transition hover:bg-[#edf1ec]">Cancel</button><button disabled={reporting} className="rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#315846] disabled:opacity-50">{reporting ? "Submitting…" : "Submit report"}</button></div></form></div>}
    </section>
  );
}
