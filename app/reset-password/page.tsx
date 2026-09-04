import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/password-recovery";

export default function ResetPasswordPage() {
  return <Suspense fallback={<main className="grid min-h-screen place-items-center">Loading…</main>}><ResetPasswordForm /></Suspense>;
}
