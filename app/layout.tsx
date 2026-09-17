import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import SiteFooter from "@/components/site-footer";
import AnalyticsTracker from "@/components/analytics-tracker";
import GoogleAnalytics from "@/components/google-analytics";
import { Suspense } from "react";
import Script from "next/script";
import { PreferencesProvider } from "@/components/preferences-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const googleSiteVerification = process.env.GOOGLE_SITE_VERIFICATION?.trim();

export const metadata: Metadata = {
  metadataBase: new URL("https://bubsbookings.com"),
  title: { default: "BubsBookings | Trusted local services", template: "%s | BubsBookings" },
  description: "Find and book trusted local professionals for the jobs on your list.",
  applicationName: "BubsBookings",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    siteName: "BubsBookings",
    url: "https://bubsbookings.com",
    title: "BubsBookings | Trusted local services",
    description: "Find and book trusted local professionals for the jobs on your list.",
    images: [{ url: "/brand-logo.png", width: 1200, height: 1200, alt: "BubsBookings — Local services. Real people." }],
  },
  twitter: { card: "summary", title: "BubsBookings", description: "Find and book trusted local professionals near you.", images: ["/brand-logo.png"] },
  ...(googleSiteVerification ? { verification: { google: googleSiteVerification } } : {}),
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const organizationJsonLd = { "@context": "https://schema.org", "@type": "Organization", name: "BubsBookings", url: "https://bubsbookings.com", description: "A marketplace for finding and booking local service providers." };
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <a href="#site-content" className="skip-link">Skip to main content</a>
        <Script id="bubsbookings-theme" strategy="beforeInteractive">{`try{const p=localStorage.getItem("bubsbookings-theme")||"system";const t=p==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):p;document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t}catch{}`}</Script>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
        <PreferencesProvider>
          <Suspense fallback={null}><AnalyticsTracker /></Suspense>
          <div id="site-content" tabIndex={-1} className="contents">{children}</div>
          <SiteFooter />
        </PreferencesProvider>
        <GoogleAnalytics />
      </body>
    </html>
  );
}
