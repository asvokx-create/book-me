import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import SiteFooter from "@/components/site-footer";
import AnalyticsTracker from "@/components/analytics-tracker";
import { Suspense } from "react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://bubsbookings.com"),
  title: { default: "BubsBookings | Trusted local services", template: "%s | BubsBookings" },
  description: "Find and book trusted local professionals for the jobs on your list.",
  applicationName: "BubsBookings",
  openGraph: {
    type: "website",
    siteName: "BubsBookings",
    url: "https://bubsbookings.com",
    title: "BubsBookings | Trusted local services",
    description: "Find and book trusted local professionals for the jobs on your list.",
  },
  twitter: { card: "summary", title: "BubsBookings", description: "Find and book trusted local professionals near you." },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const organizationJsonLd = { "@context": "https://schema.org", "@type": "Organization", name: "BubsBookings", url: "https://bubsbookings.com", description: "A marketplace for finding and booking local service providers." };
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} /><Suspense fallback={null}><AnalyticsTracker /></Suspense>{children}<SiteFooter /></body>
    </html>
  );
}
