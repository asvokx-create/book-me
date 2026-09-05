import type { Metadata } from "next";
import AccountSettings from "./settings-form";

export const metadata: Metadata = { title: "Settings | BubsBookings" };

export default function AccountSettingsPage() {
  return <AccountSettings />;
}
