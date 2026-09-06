import type { Metadata } from "next";
import SecuritySettings from "./security-settings";

export const metadata: Metadata = { title: "Account security" };

export default function AccountSecurityPage() {
  return <SecuritySettings />;
}
