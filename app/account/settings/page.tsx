import type { Metadata } from "next";
import AccountSettings from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

export default function AccountSettingsPage() {
  return <AccountSettings />;
}
