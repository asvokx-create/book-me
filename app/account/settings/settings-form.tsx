"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import ProfilePhotoManager from "@/components/profile-photo-manager";
import RadiusSelector from "@/components/radius-selector";
import { applyThemePreference, applyTimeZonePreference, getStoredThemePreference, type ThemePreference } from "@/components/preferences-provider";

type Settings = {
  name: string; email: string; imageUrl: string; phone: string; city: string; state: string; radius: number;
  bookingNotifications: boolean; messageNotifications: boolean; isProvider: boolean;
  theme: ThemePreference; timeZone: string;
};

const emptySettings: Settings = { name: "", email: "", imageUrl: "", phone: "", city: "", state: "WA", radius: 25, bookingNotifications: true, messageNotifications: true, isProvider: false, theme: "system", timeZone: "auto" };
const inputClass = "mt-2 w-full rounded-2xl border border-[#183126]/15 bg-[#faf9f5] px-4 py-3.5 text-sm outline-none transition focus:border-[#4d725d] focus:ring-2 focus:ring-[#4d725d]/10";
const timeZones = [
  "America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York",
  "America/Anchorage", "Pacific/Honolulu", "America/Phoenix", "UTC",
];

export default function AccountSettings() {
  const router = useRouter();
  const { data: session, isPending, refetch } = authClient.useSession();
  const [settings, setSettings] = useState(emptySettings);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [securityBusy, setSecurityBusy] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [deletionConfirmation, setDeletionConfirmation] = useState("");
  const [deletionBusy, setDeletionBusy] = useState(false);

  useEffect(() => {
    if (!isPending && !session) router.replace("/login?redirect=/account/settings");
  }, [isPending, router, session]);

  useEffect(() => {
    if (!session) return;
    let active = true;
    fetch("/api/account/settings", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as Settings & { error?: string };
        if (!response.ok) throw new Error(data.error ?? "Settings could not be loaded.");
        if (active) {
          const theme = getStoredThemePreference() ?? data.theme;
          setSettings({ ...data, theme });
          applyThemePreference(theme);
          applyTimeZonePreference(data.timeZone);
        }
      })
      .catch((reason: Error) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [session]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(""); setMessage("");
    const response = await fetch("/api/account/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) }).catch(() => null);
    const data = response ? await response.json() as { error?: string; location?: string; radius?: number; theme?: ThemePreference; timeZone?: string } : null;
    setSaving(false);
    if (!response?.ok || !data) { setError(data?.error ?? "We could not save your settings."); return; }
    localStorage.setItem("bookme-service-area", JSON.stringify({ location: data.location, radius: data.radius }));
    if (data.theme) applyThemePreference(data.theme);
    if (data.timeZone) applyTimeZonePreference(data.timeZone);
    setMessage("Your account settings have been saved.");
    await refetch();
    router.refresh();
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage("");
    if (newPassword.length < 12) { setError("Your new password needs at least 12 characters."); return; }
    if (newPassword !== confirmPassword) { setError("The new passwords do not match."); return; }
    setSecurityBusy(true);
    const { error: authError } = await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true });
    setSecurityBusy(false);
    if (authError) { setError(authError.message ?? "We could not change your password."); return; }
    setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    setMessage("Password changed. Your other devices have been signed out.");
  }

  async function requestEmailChange() {
    setError(""); setMessage("");
    const normalizedEmail = newEmail.trim().toLowerCase();
    if (!normalizedEmail || normalizedEmail === settings.email.toLowerCase()) {
      setError("Enter a different email address.");
      return;
    }
    setEmailBusy(true);
    const { error: authError } = await authClient.changeEmail({
      newEmail: normalizedEmail,
      callbackURL: "/account/settings?emailChanged=1",
    });
    setEmailBusy(false);
    if (authError) {
      setError(authError.message ?? "We could not start the email change.");
      return;
    }
    setNewEmail("");
    setMessage(`We sent a verification link to ${normalizedEmail}. Your current email stays active until you verify the new one.`);
  }

  async function signOutOtherDevices() {
    setSecurityBusy(true); setError(""); setMessage("");
    const { error: authError } = await authClient.revokeOtherSessions();
    setSecurityBusy(false);
    if (authError) { setError(authError.message ?? "We could not sign out your other devices."); return; }
    setMessage("All other devices have been signed out.");
  }

  async function deleteAccount() {
    setError(""); setMessage("");
    if (deletionConfirmation.trim().toLowerCase() !== settings.email.toLowerCase()) {
      setError("Type your account email exactly to confirm deletion.");
      return;
    }
    if (!window.confirm("Permanently delete your BubsBookings account and associated data? This cannot be undone.")) return;
    setDeletionBusy(true);
    const response = await fetch("/api/account", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation: deletionConfirmation }) }).catch(() => null);
    const data = response ? await response.json() as { error?: string } : null;
    if (!response?.ok) {
      setDeletionBusy(false);
      setError(data?.error ?? "We could not delete your account. Please try again.");
      return;
    }
    localStorage.removeItem("bookme-service-area");
    localStorage.removeItem("bookme-location-permission-asked");
    await authClient.signOut().catch(() => undefined);
    router.replace("/?accountDeleted=1");
    router.refresh();
  }

  if (isPending || !session || !loaded) return <main className="grid min-h-screen place-items-center bg-[#f5f4ef] text-[#183126]"><p className="font-semibold">Loading settings…</p></main>;

  return <main className="min-h-screen bg-[#f5f4ef] text-[#183126]">
    <header className="border-b border-[#183126]/10 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8"><Link href="/" className="flex items-center gap-2.5 text-xl font-bold"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#183126] text-sm text-[#eee25a]">B</span>BubsBookings</Link><Link href={settings.isProvider ? "/provider/dashboard" : "/account"} className="rounded-full px-4 py-2 text-sm font-bold transition hover:bg-[#dfead9]">← Back to dashboard</Link></div></header>
    <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#718078]">Your account</p><h1 className="mt-2 text-4xl font-bold tracking-[-.045em]">Settings</h1><p className="mt-2 text-[#6b7b73]">Keep your details, preferences, and account security up to date.</p></div>
      {message && <p role="status" className="mt-6 rounded-2xl bg-[#e3f1e5] px-5 py-4 text-sm font-bold text-[#34704a]">✓ {message}</p>}
      {error && <p role="alert" className="mt-6 rounded-2xl bg-[#fff1e8] px-5 py-4 text-sm font-bold text-[#9a4e25]">{error}</p>}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
        <form onSubmit={saveProfile} className="space-y-6">
          <section className="rounded-[2rem] border border-[#183126]/10 bg-white p-6 sm:p-8"><h2 className="text-xl font-bold">Personal information</h2><p className="mt-1 text-sm text-[#738179]">This information stays connected to your bookings and messages.</p><ProfilePhotoManager name={settings.name} initialUrl={settings.imageUrl} onChange={(imageUrl) => { setSettings((current) => ({ ...current, imageUrl })); void refetch(); router.refresh(); }} /><div className="mt-6 grid gap-5 sm:grid-cols-2"><label className="text-sm font-bold">Full name<input required value={settings.name} onChange={(event) => setSettings({ ...settings, name: event.target.value })} autoComplete="name" className={inputClass} /></label><label className="text-sm font-bold">Phone number <span className="font-normal text-[#718078]">(optional)</span><input value={settings.phone} onChange={(event) => setSettings({ ...settings, phone: event.target.value })} inputMode="tel" autoComplete="tel" placeholder="4255550123" className={inputClass} /></label><label className="text-sm font-bold sm:col-span-2">Current email address<input readOnly value={settings.email} className={`${inputClass} cursor-not-allowed text-[#718078]`} /></label></div><div className="mt-5 rounded-2xl bg-[#f5f5ef] p-4"><label className="text-sm font-bold">Change email address<input required type="email" autoComplete="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} placeholder="you@yourbusiness.com" className={inputClass} /></label><p className="mt-2 text-xs leading-5 text-[#718078]">We will send a verification link to the new address. Your current email remains active until the link is confirmed.</p><button type="button" onClick={() => void requestEmailChange()} disabled={emailBusy || !newEmail.trim()} className="mt-3 rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#315846] disabled:opacity-50">{emailBusy ? "Sending…" : "Send verification link"}</button></div></section>
          <section className="rounded-[2rem] border border-[#183126]/10 bg-white p-6 sm:p-8"><h2 className="text-xl font-bold">Your default area</h2><p className="mt-1 text-sm text-[#738179]">BubsBookings will remember this area when you search for nearby services.</p><div className="mt-6 grid gap-5 sm:grid-cols-[1fr_120px_190px]"><label className="text-sm font-bold">City<input required value={settings.city} onChange={(event) => setSettings({ ...settings, city: event.target.value })} placeholder="Issaquah" className={inputClass} /></label><label className="text-sm font-bold">State<input required maxLength={2} value={settings.state} onChange={(event) => setSettings({ ...settings, state: event.target.value.toUpperCase() })} className={inputClass} /></label><div className="text-sm font-bold"><p>Search radius</p><span className="mt-2 block"><RadiusSelector value={settings.radius} onChange={(radius) => setSettings({ ...settings, radius })} /></span></div></div><p className="mt-3 text-xs text-[#718078]">Choose a common distance or select Custom to enter any whole number from 1 to 250 miles.</p></section>
          <section className="rounded-[2rem] border border-[#183126]/10 bg-white p-6 sm:p-8"><h2 className="text-xl font-bold">Display and time</h2><p className="mt-1 text-sm text-[#738179]">Choose how BubsBookings looks and how booking times are displayed.</p><fieldset className="mt-6"><legend className="text-sm font-bold">Appearance</legend><div className="mt-2 grid grid-cols-3 gap-2">{(["light", "dark", "system"] as const).map((theme) => <button key={theme} type="button" aria-pressed={settings.theme === theme} onClick={() => { setSettings({ ...settings, theme }); applyThemePreference(theme); }} className={`rounded-2xl border px-3 py-3 text-sm font-bold capitalize transition ${settings.theme === theme ? "border-[#183126] bg-[#183126] text-white" : "border-[#183126]/12 bg-[#faf9f5] hover:bg-[#e5eddf]"}`}>{theme === "light" ? "☀ Light" : theme === "dark" ? "◐ Dark" : "◑ System"}</button>)}</div></fieldset><label className="mt-6 block text-sm font-bold">Time zone<select value={settings.timeZone} onChange={(event) => { const timeZone = event.target.value; setSettings({ ...settings, timeZone }); applyTimeZonePreference(timeZone); }} className={inputClass}><option value="auto">Automatic (device time zone)</option>{timeZones.map((timeZone) => <option key={timeZone} value={timeZone}>{timeZone.replaceAll("_", " ")}</option>)}</select><span className="mt-2 block text-xs font-normal leading-5 text-[#718078]">Automatic is recommended when you travel. A selected zone keeps booking times fixed to that location.</span></label></section>
          <section className="rounded-[2rem] border border-[#183126]/10 bg-white p-6 sm:p-8"><h2 className="text-xl font-bold">Notification preferences</h2><p className="mt-1 text-sm text-[#738179]">Choose what appears in your BubsBookings notification center.</p><div className="mt-5 divide-y divide-[#183126]/10"><SettingToggle title="Booking updates" description="Requests, confirmations, changes, reminders, and cancellations." checked={settings.bookingNotifications} onChange={(checked) => setSettings({ ...settings, bookingNotifications: checked })} /><SettingToggle title="New messages" description="Messages sent between you and a customer or provider." checked={settings.messageNotifications} onChange={(checked) => setSettings({ ...settings, messageNotifications: checked })} /></div></section>
          <button disabled={saving} className="w-full rounded-full bg-[#eee25a] px-6 py-4 font-bold transition hover:-translate-y-0.5 hover:bg-[#f5ea6b] disabled:opacity-60">{saving ? "Saving…" : "Save account settings"}</button>
        </form>

        <div className="space-y-6">
          <section className="rounded-[2rem] border border-[#183126]/10 bg-white p-6 sm:p-8"><h2 className="text-xl font-bold">Password</h2><p className="mt-1 text-sm text-[#738179]">Changing it will also sign out your other devices.</p><form onSubmit={changePassword} className="mt-5 space-y-4"><label className="block text-sm font-bold">Current password<input required type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className={inputClass} /></label><label className="block text-sm font-bold">New password<input required type="password" minLength={12} maxLength={128} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className={inputClass} /></label><label className="block text-sm font-bold">Confirm new password<input required type="password" minLength={12} maxLength={128} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className={inputClass} /></label><button disabled={securityBusy} className="w-full rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#315846] disabled:opacity-60">Change password</button></form></section>
          <section className="rounded-[2rem] border border-[#183126]/10 bg-white p-6 sm:p-8"><h2 className="text-xl font-bold">Security</h2><div className="mt-5 space-y-3"><Link href="/account/security" className="flex items-center justify-between rounded-2xl bg-[#f5f5ef] p-4 font-bold transition hover:bg-[#e3ecde]"><span>🔐 Authenticator protection</span><span>→</span></Link><button type="button" disabled={securityBusy} onClick={signOutOtherDevices} className="flex w-full items-center justify-between rounded-2xl bg-[#f5f5ef] p-4 text-left font-bold transition hover:bg-[#e3ecde] disabled:opacity-60"><span>Sign out other devices</span><span>→</span></button></div></section>
          {settings.isProvider && <section className="rounded-[2rem] bg-[#183126] p-6 text-white sm:p-8"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#b5c5bd]">Provider tools</p><h2 className="mt-2 text-xl font-bold">Business settings</h2><div className="mt-5 grid gap-3"><Link href="/providers/join" className="rounded-2xl bg-white/10 p-4 font-bold transition hover:bg-white/20">Edit business profile →</Link><Link href="/provider/dashboard/services" className="rounded-2xl bg-white/10 p-4 font-bold transition hover:bg-white/20">Manage services →</Link><Link href="/provider/dashboard/availability" className="rounded-2xl bg-white/10 p-4 font-bold transition hover:bg-white/20">Set availability →</Link></div></section>}
          <section className="rounded-[2rem] border border-[#183126]/10 bg-white p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#718078]">Your data</p><h2 className="mt-2 text-xl font-bold">Download or delete</h2><p className="mt-2 text-sm leading-6 text-[#738179]">Download a JSON copy of the account, bookings, messages, reviews, reports, and provider information connected to you.</p><a href="/api/account/data-export" download className="mt-5 inline-flex rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#315846]">Download my data</a><div className="mt-7 border-t border-[#183126]/10 pt-6"><h3 className="font-bold text-[#8e382f]">Delete account permanently</h3><p className="mt-2 text-xs leading-5 text-[#738179]">This removes your BubsBookings profile and associated marketplace data and cancels connected subscriptions. Active bookings, unresolved disputes, or unsettled payments must be completed first. Some payment records may remain with Stripe where legally required.</p><label className="mt-4 block text-sm font-bold">Type {settings.email} to confirm<input type="email" autoComplete="off" value={deletionConfirmation} onChange={(event) => setDeletionConfirmation(event.target.value)} className={inputClass} /></label><button type="button" onClick={() => void deleteAccount()} disabled={deletionBusy || deletionConfirmation.trim().toLowerCase() !== settings.email.toLowerCase()} className="mt-4 w-full rounded-full bg-[#7b2d27] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#67231f] disabled:cursor-not-allowed disabled:opacity-45">{deletionBusy ? "Deleting account…" : "Permanently delete my account"}</button></div></section>
          <section className="rounded-[2rem] border border-[#183126]/10 bg-white p-6"><h2 className="font-bold">Privacy and policies</h2><div className="mt-3 flex flex-wrap gap-4 text-sm font-bold"><Link href="/privacy" className="underline decoration-[#c8bc43] decoration-2 underline-offset-4">Privacy</Link><Link href="/terms" className="underline decoration-[#c8bc43] decoration-2 underline-offset-4">Terms</Link><Link href="/ai-transparency" className="underline decoration-[#c8bc43] decoration-2 underline-offset-4">AI transparency</Link></div></section>
        </div>
      </div>
    </div>
  </main>;
}

function SettingToggle({ title, description, checked, onChange }: { title: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex cursor-pointer items-center gap-4 py-4 first:pt-0 last:pb-0"><span className="min-w-0 flex-1"><span className="block font-bold">{title}</span><span className="mt-1 block text-xs leading-5 text-[#738179]">{description}</span></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="peer sr-only" /><span className="relative h-7 w-12 shrink-0 rounded-full bg-[#d8ddd9] transition peer-checked:bg-[#183126] after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" /></label>;
}
