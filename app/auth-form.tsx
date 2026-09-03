"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "../lib/auth-client";

export default function AuthForm({ mode, redirectTo = "/account" }: { mode: "login" | "signup"; redirectTo?: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isLogin = mode === "login";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const phoneDigits = phone.replace(/\D/g, "");
    if ((!isLogin && (!name.trim() || phoneDigits.length < 10)) || !email.includes("@") || password.length < 8) {
      setError("Enter valid account details. Phone numbers need 10 digits and passwords need at least 8 characters.");
      return;
    }

    setError("");
    setLoading(true);

    if (isLogin) {
      const { error: authError } = await authClient.signIn.email({ email, password, rememberMe });
      setLoading(false);
      if (authError) {
        setError(authError.message ?? "We could not log you in. Check your details and try again.");
        return;
      }
      router.push(redirectTo);
      router.refresh();
      return;
    }

    const { error: authError } = await authClient.signUp.email({
      email,
      password,
      name: name.trim(),
      phone: phone.trim(),
      callbackURL: redirectTo,
    });
    setLoading(false);
    if (authError) {
      setError(authError.message ?? "We could not create your account. Please try again.");
      return;
    }
    if (!rememberMe) {
      await authClient.signOut();
      const { error: sessionError } = await authClient.signIn.email({ email, password, rememberMe: false });
      if (sessionError) {
        setError(sessionError.message ?? "Your account was created, but we could not start the session. Please log in.");
        return;
      }
    }
    router.push(redirectTo);
    router.refresh();
  }

  const inputClass = "w-full rounded-2xl border border-[#183126]/15 bg-[#faf9f5] px-4 py-3.5 text-sm outline-none transition focus:border-[#4d725d] focus:ring-2 focus:ring-[#4d725d]/10";

  return (
    <div className="w-full max-w-md rounded-[2rem] border border-[#183126]/10 bg-white p-6 shadow-[0_24px_70px_rgba(24,49,38,.14)] sm:p-9">
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-[.16em] text-[#687b70]">{isLogin ? "Welcome back" : "Join BookMe"}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-.04em]">{isLogin ? "Log in to your account" : "Create your account"}</h1>
        <p className="mt-3 text-sm leading-6 text-[#718078]">{isLogin ? "Manage bookings and connect with your favorite local pros." : "Find trusted local help and keep every booking in one place."}</p>
      </div>

      <div className="mt-7 grid grid-cols-2 gap-3">
        <button type="button" disabled title="Coming soon" className="cursor-not-allowed rounded-2xl border border-[#183126]/15 px-4 py-3 text-sm font-bold opacity-55"><span className="mr-2">G</span>Google</button>
        <button type="button" disabled title="Coming soon" className="cursor-not-allowed rounded-2xl border border-[#183126]/15 px-4 py-3 text-sm font-bold opacity-55"><span className="mr-2">●</span>Apple</button>
      </div>
      <div className="my-6 flex items-center gap-3"><span className="h-px flex-1 bg-[#183126]/10" /><span className="text-xs text-[#89958f]">or continue with email</span><span className="h-px flex-1 bg-[#183126]/10" /></div>

      <form onSubmit={submit} className="space-y-4">
        {!isLogin && <label className="block"><span className="mb-2 block text-sm font-bold">Full name</span><input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your full name" className={inputClass} /></label>}
        <label className="block"><span className="mb-2 block text-sm font-bold">Email address</span><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className={inputClass} /></label>
        {!isLogin && <label className="block"><span className="mb-2 block text-sm font-bold">Phone number</span><input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="(425) 555-0123" className={inputClass} /><span className="mt-2 block text-xs text-[#849189]">Used for booking updates and provider communication.</span></label>}
        <label className="block"><span className="mb-2 flex items-center justify-between text-sm font-bold">Password {isLogin && <button type="button" className="rounded-full px-2 py-1 text-xs text-[#5a7563] underline decoration-[#c7bb41] decoration-2 underline-offset-4 transition hover:bg-[#eee25a]">Forgot password?</button>}</span><input type="password" autoComplete={isLogin ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" className={inputClass} /></label>
        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[#183126]/10 bg-[#faf9f5] px-4 py-3"><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} className="h-4 w-4 accent-[#183126]" /><span className="text-sm font-semibold">Keep me signed in on this device</span></label>
        {error && <p role="alert" className="rounded-xl bg-[#fff1e8] px-3 py-2.5 text-xs font-semibold text-[#9a4e25]">{error}</p>}
        <button type="submit" disabled={loading} className="w-full rounded-full bg-[#eee25a] px-6 py-4 font-bold text-[#183126] transition hover:-translate-y-0.5 hover:bg-[#f5ea6b] disabled:cursor-wait disabled:opacity-60">{loading ? "Please wait…" : isLogin ? "Log in" : "Create account"}</button>
      </form>

      <p className="mt-6 text-center text-sm text-[#74837b]">{isLogin ? "New to BookMe?" : "Already have an account?"} <Link href={`${isLogin ? "/signup" : "/login"}${redirectTo !== "/account" ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`} className="font-bold text-[#183126] underline decoration-[#c7bb41] decoration-2 underline-offset-4">{isLogin ? "Sign up" : "Log in"}</Link></p>
      {!isLogin && <p className="mt-5 text-center text-[11px] leading-5 text-[#89958f]">By creating an account, you agree to BookMe&apos;s Terms of Service and Privacy Policy.</p>}
    </div>
  );
}
