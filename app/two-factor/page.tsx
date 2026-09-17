import type { Metadata } from "next";
import TwoFactorForm from "./two-factor-form";

export const metadata: Metadata = { title: "Verify your sign in", robots: { index: false, follow: false } };

export default function TwoFactorPage() {
  return <TwoFactorForm />;
}
