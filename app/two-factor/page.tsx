import type { Metadata } from "next";
import TwoFactorForm from "./two-factor-form";

export const metadata: Metadata = { title: "Verify your sign in | BubsBookings" };

export default function TwoFactorPage() {
  return <TwoFactorForm />;
}
