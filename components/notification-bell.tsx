"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  href: string;
  read: boolean;
  createdAt: string;
};

function relativeTime(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d ago` : new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function notificationIcon(type: string) {
  if (type === "new_message") return "✉";
  if (type === "booking_accepted") return "✓";
  if (type === "booking_cancelled" || type === "booking_declined") return "×";
  if (type === "booking_completed") return "★";
  if (type === "booking_reminder") return "◷";
  return "↗";
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [actionError, setActionError] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  async function loadNotifications() {
    const response = await fetch("/api/notifications", { cache: "no-store" }).catch(() => null);
    if (!response?.ok) return;
    const data = await response.json() as { notifications: Notification[]; unreadCount: number };
    setNotifications(data.notifications);
    setUnreadCount(data.unreadCount);
    setLoaded(true);
  }

  useEffect(() => {
    const initialLoadTimer = window.setTimeout(() => { void loadNotifications(); }, 0);
    const interval = window.setInterval(() => { void loadNotifications(); }, 30_000);
    return () => { window.clearTimeout(initialLoadTimer); window.clearInterval(interval); };
  }, []);

  useEffect(() => {
    function closeWhenClickedAway(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", closeWhenClickedAway);
    return () => document.removeEventListener("mousedown", closeWhenClickedAway);
  }, []);

  async function markRead(notificationId: string) {
    const notification = notifications.find((item) => item.id === notificationId);
    if (!notification || notification.read) return;
    setNotifications((current) => current.map((item) => item.id === notificationId ? { ...item, read: true } : item));
    setUnreadCount((count) => Math.max(0, count - 1));
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId }),
    }).catch(() => null);
  }

  async function markAllRead() {
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
    setUnreadCount(0);
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    }).catch(() => null);
  }

  async function deleteNotification(notificationId: string) {
    if (!window.confirm("Delete this notification?")) return;
    setActionError("");
    const notification = notifications.find((item) => item.id === notificationId);
    const response = await fetch("/api/notifications", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId }),
    }).catch(() => null);
    if (!response?.ok) {
      setActionError("We could not delete that notification. Please try again.");
      return;
    }
    setNotifications((current) => current.filter((item) => item.id !== notificationId));
    if (notification && !notification.read) setUnreadCount((count) => Math.max(0, count - 1));
  }

  async function clearReadNotifications() {
    const readCount = notifications.filter((item) => item.read).length;
    if (!readCount || !window.confirm(`Delete ${readCount} read ${readCount === 1 ? "notification" : "notifications"}?`)) return;
    setActionError("");
    const response = await fetch("/api/notifications", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allRead: true }),
    }).catch(() => null);
    if (response?.ok) setNotifications((current) => current.filter((item) => !item.read));
    else setActionError("We could not clear your read notifications. Please try again.");
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-expanded={open}
        onClick={() => { setOpen((value) => !value); if (!loaded) loadNotifications(); }}
        className="relative grid h-10 w-10 place-items-center rounded-full border border-[#183126]/10 bg-[#faf9f5] transition hover:border-[#b8aa2e] hover:bg-[#eee25a]"
      >
        🔔
        {unreadCount > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full border-2 border-white bg-[#d45f40] px-1 text-[10px] font-bold leading-none text-white">{unreadCount > 9 ? "9+" : unreadCount}</span>}
      </button>

      {open && <div className="absolute right-0 top-12 z-[70] w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-[#183126]/10 bg-white text-left shadow-[0_24px_70px_rgba(24,49,38,.2)]">
        <div className="flex items-center justify-between border-b border-[#183126]/10 px-5 py-4">
          <div><p className="font-bold text-[#183126]">Notifications</p><p className="mt-0.5 text-xs text-[#728179]">{unreadCount ? `${unreadCount} unread` : "You’re all caught up"}</p></div>
          <div className="flex items-center gap-1">{notifications.some((item) => item.read) && <button type="button" onClick={clearReadNotifications} className="rounded-full px-3 py-2 text-xs font-bold text-[#8a4c3a] transition hover:bg-[#f4d8cc]">Clear read</button>}{unreadCount > 0 && <button type="button" onClick={markAllRead} className="rounded-full px-3 py-2 text-xs font-bold text-[#50695b] transition hover:bg-[#e5eddf]">Mark all read</button>}</div>
        </div>
        {actionError && <p role="alert" className="border-b border-[#e8c2ae] bg-[#fff0e8] px-5 py-3 text-xs font-semibold text-[#964f2c]">{actionError}</p>}
        <div className="max-h-[26rem] overflow-y-auto">
          {!loaded ? <div className="p-8 text-center text-sm text-[#728179]">Loading updates…</div> : notifications.length === 0 ? <div className="p-8 text-center"><p className="text-3xl">🔔</p><p className="mt-3 font-bold text-[#183126]">No notifications yet</p><p className="mt-1 text-sm text-[#728179]">Booking updates will appear here.</p></div> : notifications.map((notification) => <div key={notification.id} className={`group flex items-start gap-1 border-b border-[#183126]/8 pr-3 last:border-0 ${notification.read ? "bg-white" : "bg-[#fbf9df]"}`}><Link
            href={notification.href}
            onClick={() => { markRead(notification.id); setOpen(false); }}
            className="flex min-w-0 flex-1 gap-3 px-5 py-4 pr-2 transition hover:bg-[#f3f5ed]"
          >
            <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl font-bold ${notification.read ? "bg-[#edf1ea] text-[#64766c]" : "bg-[#eee25a] text-[#183126]"}`}>{notificationIcon(notification.type)}</span>
            <span className="min-w-0 flex-1"><span className="flex items-start justify-between gap-3"><span className="text-sm font-bold text-[#183126]">{notification.title}</span>{!notification.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#d45f40]" />}</span><span className="mt-1 block text-xs leading-5 text-[#66776e]">{notification.message}</span><span className="mt-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#89958f]">{relativeTime(notification.createdAt)}</span></span>
          </Link><button type="button" aria-label={`Delete ${notification.title} notification`} onClick={() => deleteNotification(notification.id)} className="mt-3 grid h-8 w-8 shrink-0 place-items-center rounded-full text-[#8a4c3a] opacity-70 transition hover:bg-[#f4d8cc] hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100">×</button></div>)}
        </div>
      </div>}
    </div>
  );
}
