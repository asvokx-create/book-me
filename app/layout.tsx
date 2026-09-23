import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import SiteFooter from "@/components/site-footer";
import AnalyticsTracker from "@/components/analytics-tracker";
import GoogleAnalytics from "@/components/google-analytics";
import { Suspense } from "react";
import Script from "next/script";
import { PreferencesProvider } from "@/components/preferences-provider";
import InternalNavigationHistory from "@/components/internal-navigation-history";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-manrope",
  fallback: ["Segoe UI", "Arial", "sans-serif"],
});

const googleSiteVerification = process.env.GOOGLE_SITE_VERIFICATION?.trim();

export const metadata: Metadata = {
  metadataBase: new URL("https://bubsbookings.com"),
  title: { default: "BubsBookings | Find and book local services", template: "%s | BubsBookings" },
  description: "Search local service providers, compare listings, message businesses, and request bookings with clear payment and support tools.",
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
    title: "BubsBookings | Find and book local services",
    description: "Search local providers, compare listings, and request bookings in one place.",
    images: [{ url: "/brand-logo.png", width: 1200, height: 1200, alt: "BubsBookings — Local services. Real people." }],
  },
  twitter: { card: "summary", title: "BubsBookings", description: "Find and book local service providers near you.", images: ["/brand-logo.png"] },
  ...(googleSiteVerification ? { verification: { google: googleSiteVerification } } : {}),
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const organizationJsonLd = { "@context": "https://schema.org", "@graph": [
    { "@type": "Organization", "@id": "https://bubsbookings.com/#organization", name: "BubsBookings", url: "https://bubsbookings.com", logo: { "@type": "ImageObject", url: "https://bubsbookings.com/brand-logo.png" }, description: "A marketplace for finding and booking local service providers." },
    { "@type": "WebSite", "@id": "https://bubsbookings.com/#website", name: "BubsBookings", url: "https://bubsbookings.com", publisher: { "@id": "https://bubsbookings.com/#organization" }, potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: "https://bubsbookings.com/services?q={search_term_string}" }, "query-input": "required name=search_term_string" } },
  ] };
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${manrope.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <a href="#site-content" className="skip-link">Skip to main content</a>
        <Script id="bubsbookings-theme" strategy="beforeInteractive">{`try{const p=localStorage.getItem("bubsbookings-theme")||"system";const t=p==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):p;document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t}catch{}`}</Script>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
        <PreferencesProvider>
          <Suspense fallback={null}><AnalyticsTracker /><InternalNavigationHistory /></Suspense>
          <div id="site-content" tabIndex={-1} className="contents">{children}</div>
          <SiteFooter />
        </PreferencesProvider>
        <GoogleAnalytics />
      </body>
    </html>
  );
}
