import type { Metadata } from "next";
import Link from "next/link";
import { readOutreachUnsubscribeToken } from "@/lib/provider-outreach-email";
import OutreachUnsubscribeButton from "@/components/outreach-unsubscribe-button";

export const metadata: Metadata = { title: "Provider outreach preferences", robots: { index: false, follow: false } };

export default async function OutreachUnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? "";
  const valid = Boolean(readOutreachUnsubscribeToken(token));
  return <main className="min-h-screen bg-[#f4f4ef] px-5 py-16 text-[#183126]"><section className="mx-auto max-w-xl rounded-[2rem] border border-[#183126]/10 bg-white p-7 text-center shadow-lg sm:p-10"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#718078]">Email preferences</p><h1 className="mt-3 text-3xl font-bold">Stop provider outreach emails</h1><p className="mt-4 text-sm leading-6 text-[#687970]">This permanently stops promotional provider-outreach messages from BubsBookings at this email address.</p>{valid ? <OutreachUnsubscribeButton token={token} /> : <p role="alert" className="mt-6 rounded-2xl bg-[#fff1e8] p-4 text-sm font-bold text-[#9a4e25]">This preference link is invalid or expired.</p>}<Link href="/" className="mt-7 inline-flex text-sm font-bold underline underline-offset-4">Return to BubsBookings</Link></section></main>;
}
