"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "react-qr-code";
import { authClient } from "@/lib/auth-client";

type Enrollment = { totpURI: string; backupCodes: string[] };

export default function SecuritySettings() {
  const router = useRouter();
  const { data: session, isPending, refetch } = authClient.useSession();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const twoFactorEnabled = Boolean((session?.user as { twoFactorEnabled?: boolean } | undefined)?.twoFactorEnabled);
  const manualKey = useMemo(() => {
    if (!enrollment) return "";
    try { return new URL(enrollment.totpURI).searchParams.get("secret") ?? ""; } catch { return ""; }
  }, [enrollment]);

  useEffect(() => {
    if (!isPending && !session) router.replace("/login?redirect=/account/security");
  }, [isPending, router, session]);

  async function beginEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    const { data, error: authError } = await authClient.twoFactor.enable({ password, method: "totp", issuer: "BookMe" });
    setLoading(false);
    if (authError || !data || data.method !== "totp") {
      setError(authError?.message ?? "We could not start authenticator setup. Check your password and try again.");
      return;
    }
    setEnrollment({ totpURI: data.totpURI, backupCodes: data.backupCodes });
    setPassword("");
  }

  async function verifyEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const { error: authError } = await authClient.twoFactor.verifyTotp({ code: code.replace(/\s/g, ""), trustDevice: true });
    setLoading(false);
    if (authError) {
      setError(authError.message ?? "That code did not work. Wait for a new code and try again.");
      return;
    }
    setEnrollment(null);
    setCode("");
    setMessage("Authenticator protection is now on. New devices will need a code when signing in.");
    await refetch();
  }

  async function disableTwoFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    const { error: authError } = await authClient.twoFactor.disable({ password });
    setLoading(false);
    if (authError) {
      setError(authError.message ?? "We could not turn off authenticator protection.");
      return;
    }
    setPassword("");
    setMessage("Authenticator protection has been turned off.");
    await refetch();
  }

  if (isPending || !session) return <main className="grid min-h-screen place-items-center bg-[#f5f4ef] text-[#183126]"><p className="font-semibold">Loading security…</p></main>;

  const inputClass = "w-full rounded-2xl border border-[#183126]/15 bg-[#faf9f5] px-4 py-3.5 text-sm outline-none transition focus:border-[#4d725d] focus:ring-2 focus:ring-[#4d725d]/10";

  return (
    <main className="min-h-screen bg-[#f5f4ef] px-5 py-8 text-[#183126] sm:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-4">
          <Link href="/account" className="flex items-center gap-2.5 text-xl font-bold"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#183126] text-sm text-[#eee25a]">B</span>BookMe</Link>
          <Link href="/account" className="rounded-full px-4 py-2 text-sm font-bold transition hover:bg-[#dfead9]">← My account</Link>
        </div>

        <section className="mt-10 rounded-[2rem] border border-[#183126]/10 bg-white p-6 shadow-[0_18px_55px_rgba(24,49,38,.08)] sm:p-9">
          <div className="flex items-start gap-4"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#e6eedf] text-2xl">🔐</span><div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#6f8077]">Account security</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Authenticator protection</h1><p className="mt-2 text-sm leading-6 text-[#6f7f77]">Sharing the BookMe link never shares your login. Turn this on for an extra code from Google Authenticator, Microsoft Authenticator, Authy, or another authenticator app.</p></div></div>

          <div className={`mt-7 rounded-2xl p-4 ${twoFactorEnabled ? "bg-[#e7f3e8]" : "bg-[#fff7c9]"}`}><p className="font-bold">{twoFactorEnabled ? "✓ Authenticator is on" : "Authenticator is off"}</p><p className="mt-1 text-sm text-[#66776e]">{twoFactorEnabled ? "A code is required when your account signs in on a new device." : "Your password still protects your account. Add an authenticator for stronger protection."}</p></div>

          {message && <p role="status" className="mt-5 rounded-xl bg-[#e7f3e8] px-4 py-3 text-sm font-semibold text-[#33704a]">{message}</p>}
          {error && <p role="alert" className="mt-5 rounded-xl bg-[#fff1e8] px-4 py-3 text-sm font-semibold text-[#9a4e25]">{error}</p>}

          {!twoFactorEnabled && !enrollment && <form onSubmit={beginEnrollment} className="mt-7"><label className="block"><span className="mb-2 block text-sm font-bold">Confirm your current password</span><input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} /></label><button disabled={loading} className="mt-4 w-full rounded-full bg-[#eee25a] px-6 py-4 font-bold transition hover:-translate-y-0.5 hover:bg-[#f5ea6b] disabled:opacity-60">{loading ? "Starting setup…" : "Set up authenticator"}</button></form>}

          {!twoFactorEnabled && enrollment && <div className="mt-7"><div className="grid gap-6 sm:grid-cols-[190px_1fr] sm:items-center"><div className="rounded-2xl border border-[#183126]/10 bg-white p-3"><QRCode value={enrollment.totpURI} size={164} style={{ height: "auto", maxWidth: "100%", width: "100%" }} /></div><div><h2 className="text-xl font-bold">Scan this code</h2><p className="mt-2 text-sm leading-6 text-[#6f7f77]">Open your authenticator app, add a new account, and scan the QR code. Then enter the six-digit code below.</p>{manualKey && <div className="mt-3 rounded-xl bg-[#f5f4ef] p-3"><p className="text-xs font-bold uppercase tracking-wider text-[#718078]">Manual setup key</p><code className="mt-1 block break-all text-xs">{manualKey}</code></div>}</div></div><form onSubmit={verifyEnrollment} className="mt-6"><label className="block"><span className="mb-2 block text-sm font-bold">Six-digit authenticator code</span><input required inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="123456" className={inputClass} /></label><button disabled={loading || code.length !== 6} className="mt-4 w-full rounded-full bg-[#183126] px-6 py-4 font-bold text-white transition hover:bg-[#315846] disabled:opacity-50">{loading ? "Checking code…" : "Verify and turn on"}</button></form><div className="mt-6 rounded-2xl border border-[#b8aa32]/30 bg-[#fffbed] p-4"><p className="font-bold">Save these backup codes somewhere private</p><p className="mt-1 text-xs leading-5 text-[#6f7f77]">Each code works once if you lose access to your authenticator app.</p><div className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs">{enrollment.backupCodes.map((backupCode) => <code key={backupCode} className="rounded-lg bg-white px-3 py-2 text-center">{backupCode}</code>)}</div></div></div>}

          {twoFactorEnabled && <form onSubmit={disableTwoFactor} className="mt-7 border-t border-[#183126]/10 pt-6"><h2 className="font-bold">Turn off authenticator</h2><p className="mt-1 text-sm text-[#6f7f77]">You will need your current password.</p><input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className={`${inputClass} mt-4`} /><button disabled={loading} className="mt-3 rounded-full px-4 py-2 text-sm font-bold text-[#914e3a] transition hover:bg-[#f4d8cc]">{loading ? "Please wait…" : "Turn off authenticator"}</button></form>}
        </section>
      </div>
    </main>
  );
}
