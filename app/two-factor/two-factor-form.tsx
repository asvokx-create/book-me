"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function TwoFactorForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"authenticator" | "backup">("authenticator");
  const [code, setCode] = useState("");
  const [trustDevice, setTrustDevice] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const result = mode === "authenticator"
      ? await authClient.twoFactor.verifyTotp({ code: code.replace(/\s/g, ""), trustDevice })
      : await authClient.twoFactor.verifyBackupCode({ code: code.trim(), trustDevice, disableSession: false });
    setLoading(false);
    if (result.error) {
      setError(result.error.message ?? "That code did not work. Please try again.");
      return;
    }
    const redirectTo = sessionStorage.getItem("bookme-post-login-redirect") || "/account";
    sessionStorage.removeItem("bookme-post-login-redirect");
    router.push(redirectTo);
    router.refresh();
  }

  const inputClass = "w-full rounded-2xl border border-[#183126]/15 bg-[#faf9f5] px-4 py-3.5 text-center text-lg font-bold tracking-[.2em] outline-none transition focus:border-[#4d725d] focus:ring-2 focus:ring-[#4d725d]/10";

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#f8f7f3] px-5 py-8 text-[#183126]"><div className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-[#d8e7d3] blur-3xl" /><div className="relative w-full max-w-md rounded-[2rem] border border-[#183126]/10 bg-white p-7 text-center shadow-[0_24px_70px_rgba(24,49,38,.14)] sm:p-9"><Link href="/" className="inline-flex items-center gap-2.5 text-xl font-bold"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#183126] text-sm text-[#eee25a]">B</span>BubsBookings</Link><p className="mt-7 text-3xl">🔐</p><h1 className="mt-3 text-3xl font-bold tracking-tight">Verify it&apos;s you</h1><p className="mt-3 text-sm leading-6 text-[#718078]">{mode === "authenticator" ? "Enter the six-digit code from your authenticator app." : "Enter one of the backup codes you saved."}</p><form onSubmit={submit} className="mt-7"><input required autoFocus inputMode={mode === "authenticator" ? "numeric" : "text"} autoComplete="one-time-code" maxLength={mode === "authenticator" ? 6 : 32} value={code} onChange={(event) => setCode(mode === "authenticator" ? event.target.value.replace(/\D/g, "") : event.target.value)} placeholder={mode === "authenticator" ? "123456" : "Backup code"} className={inputClass} />{error && <p role="alert" className="mt-4 rounded-xl bg-[#fff1e8] px-3 py-2.5 text-xs font-semibold text-[#9a4e25]">{error}</p>}<label className="mt-4 flex cursor-pointer items-center justify-center gap-3 rounded-2xl bg-[#faf9f5] px-4 py-3"><input type="checkbox" checked={trustDevice} onChange={(event) => setTrustDevice(event.target.checked)} className="h-4 w-4 accent-[#183126]" /><span className="text-sm font-semibold">Trust this device for 30 days</span></label><button disabled={loading || !code.trim()} className="mt-4 w-full rounded-full bg-[#eee25a] px-6 py-4 font-bold transition hover:-translate-y-0.5 hover:bg-[#f5ea6b] disabled:opacity-50">{loading ? "Verifying…" : "Verify and sign in"}</button></form><button onClick={() => { setMode(mode === "authenticator" ? "backup" : "authenticator"); setCode(""); setError(""); }} className="mt-6 rounded-full px-3 py-2 text-sm font-bold underline decoration-[#c8bc43] decoration-2 underline-offset-4 transition hover:bg-[#eee25a]">{mode === "authenticator" ? "Use a backup code" : "Use authenticator code"}</button></div></main>
  );
}
