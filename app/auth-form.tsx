"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "../lib/auth-client";
import { createPolicyConsentFields } from "../lib/policy-consent";

type SocialProvider = "google";

export default function AuthForm({ mode, redirectTo = "/account", socialProviders, oauthError = false }: { mode: "login" | "signup"; redirectTo?: string; socialProviders: Record<SocialProvider, boolean>; oauthError?: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [confirmedAge, setConfirmedAge] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acknowledgedPrivacy, setAcknowledgedPrivacy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(null);
  const isLogin = mode === "login";
  const hasRequiredConsents = confirmedAge && acceptedTerms && acknowledgedPrivacy;

  async function continueWith(provider: SocialProvider) {
    if (!socialProviders[provider]) return;
    if (!isLogin && !hasRequiredConsents) {
      setError("Complete all required agreements before creating an account.");
      return;
    }

    setError("");
    setSocialLoading(provider);
    const errorCallbackURL = `/login?oauthError=1&redirect=${encodeURIComponent(redirectTo)}`;
    const newUserCallbackURL = `/account/settings?welcome=1&redirect=${encodeURIComponent(redirectTo)}`;
    const { error: authError } = await authClient.signIn.social({
      provider,
      callbackURL: redirectTo,
      errorCallbackURL,
      newUserCallbackURL,
      requestSignUp: !isLogin,
    });
    if (authError) {
      setSocialLoading(null);
      setError(authError.message ?? "We could not continue with Google.");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const phoneDigits = phone.replace(/\D/g, "");
    if ((!isLogin && (!name.trim() || (phoneDigits.length > 0 && phoneDigits.length !== 10) || !hasRequiredConsents)) || !email.includes("@") || password.length < 8) {
      setError("Enter valid account details. If provided, phone numbers need 10 digits. Passwords need at least 8 characters.");
      return;
    }

    setError("");
    setLoading(true);

    if (isLogin) {
      sessionStorage.setItem("bookme-post-login-redirect", redirectTo);
      const { data, error: authError } = await authClient.signIn.email({ email, password, rememberMe });
      setLoading(false);
      if (authError) {
        setError(authError.message ?? "We could not log you in. Check your details and try again.");
        return;
      }
      if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) return;
      sessionStorage.removeItem("bookme-post-login-redirect");
      router.push(redirectTo);
      router.refresh();
      return;
    }

    const { data: signUpData, error: authError } = await authClient.signUp.email({
      email,
      password,
      name: name.trim(),
      phone: phone.trim(),
      ...createPolicyConsentFields(),
      callbackURL: redirectTo,
    });
    setLoading(false);
    if (authError) {
      setError(authError.message ?? "We could not create your account. Please try again.");
      return;
    }
    if (!(signUpData as { token?: string | null } | null)?.token) {
      router.push("/check-email");
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
        <p className="text-xs font-bold uppercase tracking-[.16em] text-[#687b70]">{isLogin ? "Welcome back" : "Join BubsBookings"}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-.04em]">{isLogin ? "Log in to your account" : "Create your account"}</h1>
        <p className="mt-3 text-sm leading-6 text-[#718078]">{isLogin ? "Manage bookings and connect with your favorite local pros." : "Find trusted local help and keep every booking in one place."}</p>
      </div>

      <div className="mt-7">
        <SocialButton enabled={socialProviders.google} loading={socialLoading === "google"} disabled={Boolean(socialLoading)} onClick={() => void continueWith("google")} />
      </div>
      <div className="my-6 flex items-center gap-3"><span className="h-px flex-1 bg-[#183126]/10" /><span className="text-xs text-[#89958f]">or continue with email</span><span className="h-px flex-1 bg-[#183126]/10" /></div>

      <form onSubmit={submit} className="space-y-4">
        {!isLogin && <label className="block"><span className="mb-2 block text-sm font-bold">Full name</span><input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your full name" className={inputClass} /></label>}
        <label className="block"><span className="mb-2 block text-sm font-bold">Email address</span><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className={inputClass} /></label>
        {!isLogin && <label className="block"><span className="mb-2 block text-sm font-bold">Phone number <span className="font-normal text-[#718078]">(optional)</span></span><input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="(425) 555-0123" className={inputClass} /><span className="mt-2 block text-xs text-[#849189]">Used for booking updates and provider communication.</span></label>}
        <label className="block"><span className="mb-2 flex items-center justify-between text-sm font-bold">Password {isLogin && <Link href="/forgot-password" className="rounded-full px-2 py-1 text-xs text-[#5a7563] underline decoration-[#c7bb41] decoration-2 underline-offset-4 transition hover:bg-[#eee25a]">Forgot password?</Link>}</span><input type="password" autoComplete={isLogin ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" className={inputClass} /></label>
        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[#183126]/10 bg-[#faf9f5] px-4 py-3"><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} className="h-4 w-4 accent-[#183126]" /><span className="text-sm font-semibold">Keep me signed in on this device</span></label>
        {!isLogin && <div className="space-y-2 rounded-2xl border border-[#183126]/10 bg-[#faf9f5] p-4"><p className="text-xs font-bold uppercase tracking-[.12em] text-[#687b70]">Required agreements</p><label className="flex cursor-pointer items-start gap-3"><input type="checkbox" required checked={confirmedAge} onChange={(event) => setConfirmedAge(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#183126]" /><span className="text-xs leading-5 text-[#66776e]">I confirm that I am at least 18 years old and can enter a binding agreement.</span></label><label className="flex cursor-pointer items-start gap-3"><input type="checkbox" required checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#183126]" /><span className="text-xs leading-5 text-[#66776e]">I have read and agree to the <Link href="/terms" target="_blank" className="font-bold underline">Terms of Service</Link>.</span></label><label className="flex cursor-pointer items-start gap-3"><input type="checkbox" required checked={acknowledgedPrivacy} onChange={(event) => setAcknowledgedPrivacy(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#183126]" /><span className="text-xs leading-5 text-[#66776e]">I acknowledge the <Link href="/privacy" target="_blank" className="font-bold underline">Privacy Policy</Link> and <Link href="/ai-transparency" target="_blank" className="font-bold underline">AI &amp; Safety disclosure</Link>.</span></label></div>}
        {(error || oauthError) && <p role="alert" className="rounded-xl bg-[#fff1e8] px-3 py-2.5 text-xs font-semibold text-[#9a4e25]">{error || "That social sign-in could not be completed. If you are new, use Create account first."}</p>}
        <button type="submit" disabled={loading || (!isLogin && !hasRequiredConsents)} className="w-full rounded-full bg-[#eee25a] px-6 py-4 font-bold text-[#183126] transition hover:-translate-y-0.5 hover:bg-[#f5ea6b] disabled:cursor-not-allowed disabled:opacity-60">{loading ? "Please wait…" : isLogin ? "Log in" : "Create account"}</button>
      </form>

      <p className="mt-6 text-center text-sm text-[#74837b]">{isLogin ? "New to BubsBookings?" : "Already have an account?"} <Link href={`${isLogin ? "/signup" : "/login"}${redirectTo !== "/account" ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`} className="font-bold text-[#183126] underline decoration-[#c7bb41] decoration-2 underline-offset-4">{isLogin ? "Sign up" : "Log in"}</Link></p>
      {!isLogin && <p className="mt-5 text-center text-[11px] leading-5 text-[#89958f]">BubsBookings accounts are for adults age 18 or older.</p>}
    </div>
  );
}

function SocialButton({ enabled, loading, disabled, onClick }: { enabled: boolean; loading: boolean; disabled: boolean; onClick: () => void }) {
  const name = "Google";
  return <button type="button" onClick={onClick} disabled={!enabled || disabled} title={enabled ? `Continue with ${name}` : `${name} sign-in is being configured`} className="flex w-full items-center justify-center rounded-2xl border border-[#183126]/15 px-4 py-3 text-sm font-bold transition hover:border-[#4d725d] hover:bg-[#e5eddf] disabled:cursor-not-allowed disabled:opacity-55"><GoogleIcon /><span className="ml-2">{loading ? "Opening…" : name}</span></button>;
}

function GoogleIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.87h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.35Z"/><path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.42l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.39 13.9A6 6 0 0 1 6.08 12c0-.66.11-1.3.31-1.9V7.51H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.49l3.35-2.59Z"/><path fill="#EA4335" d="M12 5.97c1.47 0 2.79.5 3.83 1.5L18.7 4.6A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.96 5.51l3.35 2.59C7.18 7.73 9.39 5.97 12 5.97Z"/></svg>;
}
