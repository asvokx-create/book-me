import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/app/terms/page";

export const metadata: Metadata = { title: "Cookie Notice", alternates: { canonical: "/cookies" } };

const sections = [
  ["1. What this notice covers", <>This notice explains how BubsBookings uses cookies and similar browser technologies, including local storage. It supplements the <Link href="/privacy" className="font-bold underline">Privacy Policy</Link>. A cookie is a small piece of data stored by a browser; local storage keeps preferences or identifiers in the browser.</>],
  ["2. Necessary storage", "BubsBookings uses session and security storage to keep users signed in, protect requests, remember account and interface preferences, and provide core marketplace features. The site may store a theme choice, time-zone choice, selected service area, and similar settings in the browser. Blocking or deleting necessary storage can sign you out, reset preferences, or prevent account features from working."],
  ["3. Analytics", <><p>BubsBookings uses first-party product analytics to understand events such as searches, page and listing views, booking steps, cancellations, and refunds. The site also uses Google Analytics 4 to measure traffic and feature use. These tools can use identifiers, device and browser information, IP-derived information, pages visited, and event timestamps.</p><p className="mt-3">Google explains <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noreferrer" className="font-bold underline">how it uses information from sites that use its services</a> and provides a <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noreferrer" className="font-bold underline">Google Analytics opt-out browser add-on</a>.</p></>],
  ["4. Advertising and sales", "BubsBookings does not currently use third-party targeted-advertising cookies, sell personal information, or share personal information for cross-context behavioral advertising. If that changes, this notice and the Privacy Policy will be updated and any legally required choice will be provided before the new use begins."],
  ["5. Your controls", "You can use browser settings to delete or block cookies and local storage, and browser privacy tools or content blockers may limit analytics. Controls vary by browser and device. Disabling storage may affect sign-in, saved preferences, location selection, or other features. A browser's Do Not Track signal does not have one universally accepted meaning; BubsBookings will honor legally required opt-out signals if and when they apply to its processing."],
  ["6. Changes and contact", <>We may update this notice when technologies or practices change. Questions about cookies or analytics may be emailed to <a href="mailto:christian@bubsbookings.com" className="font-bold underline">christian@bubsbookings.com</a>.</>],
] as const;

export default function CookieNoticePage() {
  return <LegalPage eyebrow="Your choices" title="Cookie Notice" intro="The browser storage and analytics tools BubsBookings currently uses, and the controls available to you." sections={sections} />;
}
