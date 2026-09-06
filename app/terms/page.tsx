import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Terms of Service | BubsBookings" };

const sections = [
  ["1. Agreement and eligibility", "By creating an account or using BubsBookings, you agree to these Terms and our Privacy Policy. BubsBookings is intended for adults who are at least 18 years old and able to enter a binding agreement."],
  ["2. Accounts", "You must provide accurate information, keep your login secure, and use only your own account. You are responsible for activity under your account and should notify BubsBookings if you believe it has been accessed without permission."],
  ["3. Marketplace role", "BubsBookings helps customers discover and communicate with independent service providers. Unless BubsBookings states otherwise, providers are not BubsBookings employees. Providers control their services, pricing, qualifications, availability, and performance."],
  ["4. Provider responsibilities", "Providers must describe services honestly, maintain any licenses, insurance, permits, and qualifications required for their work, use appropriate photos, honor confirmed bookings, and comply with applicable laws."],
  ["5. Bookings, payments, and fees", "A request is not confirmed until the provider accepts it. Stripe processes online payments. For eligible marketplace payments, BubsBookings retains the payment in its Stripe platform balance until the provider marks the service complete and the customer confirms completion or the 48-hour confirmation window expires. BubsBookings then transfers the provider’s share, less the booking fee shown for the provider’s plan, to the provider’s connected Stripe account. Providers remain responsible for taxes, lawful pricing, fulfillment, and their connected payout account."],
  ["6. Cancellations, completion, and refunds", "Providers must mark work complete only after performing the agreed service. Customers have 48 hours after that notice to confirm completion or open a dispute; if they do neither, completion is confirmed automatically and the provider transfer may be released. A provider cancellation, or a customer cancellation outside the provider’s late-cancellation window, is automatically refunded when the payment is still held and eligible. Late cancellations, partial refunds, completed services, and payments already transferred may require review. Approved refunds return to the original payment method, and BubsBookings may reverse or offset a provider transfer. Stripe and the customer’s bank control final refund timing."],
  ["7. Professional and family-friendly conduct", "Do not post or send unlawful, hateful, sexually explicit, threatening, exploitative, harassing, deceptive, or abusive content. Do not use BubsBookings to arrange illegal activity, evade platform safeguards, impersonate another person, or misuse another person’s information."],
  ["8. Automated safety checks", "BubsBookings uses an automated Safety Bot to review text submitted in messages, listings, reviews, and booking-related fields. It may block content or create a limited safety record. Automated systems can make mistakes and do not replace emergency services or human judgment. Learn more on our AI & Safety page."],
  ["9. Content and licenses", "You keep ownership of content you submit. You give BubsBookings permission to host, display, process, and reproduce that content only as needed to operate, secure, improve, and promote the marketplace. You must have the right to submit the content."],
  ["10. Disputes and enforcement", "Try to resolve ordinary service issues through booking messages and the refund request flow. Either participant may open a dispute with accurate supporting details. BubsBookings may review booking, payment, message, and safety records; request more information; remove content; limit features; suspend accounts; or cooperate with lawful requests. Payment disputes submitted directly to a bank may also be governed by Stripe and card-network rules."],
  ["11. Disclaimers and liability", "BubsBookings cannot guarantee the identity, quality, safety, legality, availability, or outcome of every independent provider or booking. To the extent permitted by law, BubsBookings is provided as available and is not responsible for indirect, incidental, or consequential losses."],
  ["12. Changes and contact", "We may update these Terms as BubsBookings evolves. Material changes will be communicated through the service or another appropriate method. Questions may be sent through the BubsBookings support contact displayed in the app."],
] as const;

export default function TermsPage() {
  return <LegalPage eyebrow="Legal" title="Terms of Service" intro="The rules that keep BubsBookings useful, fair, and safe for customers and providers." sections={sections} />;
}

export function LegalPage({ eyebrow, title, intro, sections }: { eyebrow: string; title: string; intro: string; sections: ReadonlyArray<readonly [string, string | React.ReactNode]> }) {
  return <main className="min-h-screen bg-[#f8f7f3] text-[#183126]">
    <header className="border-b border-[#183126]/10"><div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5"><Link href="/" className="flex items-center gap-2.5 text-xl font-bold"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#183126] text-sm text-[#eee25a]">B</span>BubsBookings</Link><Link href="/" className="rounded-full px-4 py-2 text-sm font-bold transition hover:bg-[#e5eddf]">Back home</Link></div></header>
    <article className="mx-auto max-w-4xl px-6 py-14 sm:py-20">
      <p className="text-xs font-bold uppercase tracking-[.16em] text-[#65776e]">{eyebrow}</p>
      <h1 className="mt-3 text-4xl font-bold tracking-[-.05em] sm:text-5xl">{title}</h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-[#5f7068]">{intro}</p>
      <div className="mt-6 inline-flex rounded-full bg-[#e6eee2] px-4 py-2 text-xs font-bold">Effective September 5, 2026</div>
      <div className="mt-10 space-y-5">{sections.map(([heading, content]) => <section key={heading} className="rounded-[1.75rem] border border-[#183126]/10 bg-white p-6 sm:p-7"><h2 className="text-xl font-bold">{heading}</h2><div className="mt-3 text-sm leading-7 text-[#566a5f]">{content}</div></section>)}</div>
      <div className="mt-10 flex flex-wrap gap-3"><Link href="/privacy" className="rounded-full border border-[#183126]/15 bg-white px-5 py-3 text-sm font-bold transition hover:bg-[#e5eddf]">Read Privacy Policy</Link><Link href="/ai-transparency" className="rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#315846]">AI & safety details</Link></div>
      <p className="mt-8 text-xs leading-5 text-[#7b8982]">These terms are a practical launch policy and should be reviewed by a qualified attorney before BubsBookings accepts payments or expands into additional jurisdictions.</p>
    </article>
  </main>;
}
