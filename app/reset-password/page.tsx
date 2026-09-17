import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/password-recovery";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false, follow: false } };

export default function ResetPasswordPage() {
  return <Suspense fallback={<main className="grid min-h-screen place-items-center">Loading…</main>}><ResetPasswordForm /></Suspense>;
}
