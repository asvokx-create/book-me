import type { Metadata } from "next";
import AccountSettings from "./settings-form";

export const metadata: Metadata = { title: "Settings | BookMe" };

export default function AccountSettingsPage() {
  return <AccountSettings />;
}
