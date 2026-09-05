"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";

const inputClass = "w-full rounded-2xl border border-[#183126]/15 bg-[#faf9f5] px-4 py-3.5 text-sm outline-none focus:border-[#4d725d] focus:ring-2 focus:ring-[#4d725d]/10";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
    setBusy(false);
    setMessage("If that email belongs to a BubsBookings account, a secure reset link is on its way.");
  }

  return <AuthCard eyebrow="Account recovery" title="Reset your password"><form onSubmit={submit} className="mt-7 space-y-4"><label className="block"><span className="mb-2 block text-sm font-bold">Email address</span><input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} /></label>{message && <p role="status" className="rounded-xl bg-[#e7f3e8] px-4 py-3 text-sm font-semibold text-[#33704a]">{message}</p>}<button disabled={busy} className="w-full rounded-full bg-[#eee25a] px-6 py-4 font-bold disabled:opacity-60">{busy ? "Sending…" : "Send reset link"}</button></form><Link href="/login" className="mt-6 inline-block text-sm font-bold underline">← Back to login</Link></AuthCard>;
}

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const invalid = Boolean(searchParams.get("error")) || !token;
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8 || password !== confirm) { setError("Use at least 8 characters and make sure both passwords match."); return; }
    setBusy(true);
    const result = await authClient.resetPassword({ newPassword: password, token });
    setBusy(false);
    if (result.error) { setError(result.error.message ?? "This reset link is invalid or expired."); return; }
    router.push("/login?reset=success");
  }

  return <AuthCard eyebrow="Account recovery" title="Choose a new password">{invalid ? <div className="mt-6"><p className="rounded-xl bg-[#fff1e8] px-4 py-3 text-sm font-semibold text-[#9a4e25]">This reset link is invalid or expired.</p><Link href="/forgot-password" className="mt-5 inline-flex rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white">Request another link</Link></div> : <form onSubmit={submit} className="mt-7 space-y-4"><label className="block"><span className="mb-2 block text-sm font-bold">New password</span><input required type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} /></label><label className="block"><span className="mb-2 block text-sm font-bold">Confirm password</span><input required type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} className={inputClass} /></label>{error && <p role="alert" className="rounded-xl bg-[#fff1e8] px-4 py-3 text-sm font-semibold text-[#9a4e25]">{error}</p>}<button disabled={busy} className="w-full rounded-full bg-[#eee25a] px-6 py-4 font-bold disabled:opacity-60">{busy ? "Saving…" : "Save new password"}</button></form>}</AuthCard>;
}

function AuthCard({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return <main className="grid min-h-screen place-items-center bg-[#f5f4ef] px-5 py-10 text-[#183126]"><section className="w-full max-w-md rounded-[2rem] border border-[#183126]/10 bg-white p-7 shadow-[0_24px_70px_rgba(24,49,38,.12)] sm:p-9"><Link href="/" className="flex items-center gap-2.5 text-xl font-bold"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#183126] text-sm text-[#eee25a]">B</span>BubsBookings</Link><p className="mt-8 text-xs font-bold uppercase tracking-[.15em] text-[#6f8077]">{eyebrow}</p><h1 className="mt-2 text-3xl font-bold tracking-tight">{title}</h1>{children}</section></main>;
}
