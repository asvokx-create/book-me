"use client";

import BrandLockup from "@/components/brand-lockup";
import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-[78vh] place-items-center bg-[#f8f7f3] px-5 py-16 text-[#183126]">
      <section className="w-full max-w-xl rounded-[2.25rem] border border-[#183126]/10 bg-white p-7 text-center shadow-[0_28px_90px_rgba(19,46,35,.14)] sm:p-11">
        <Link href="/" aria-label="BubsBookings home" className="inline-flex"><BrandLockup /></Link>
        <span aria-hidden="true" className="mx-auto mt-8 grid h-16 w-16 place-items-center rounded-2xl bg-[#fff4cc] text-3xl">↻</span>
        <h1 className="mt-5 text-3xl font-bold tracking-[-.04em] sm:text-4xl">Something didn&apos;t load.</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-[#63746b]">Your information is safe. Try this page again, or return home if the problem continues.</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3"><button type="button" onClick={reset} className="rounded-full bg-[#eee25a] px-6 py-3.5 text-sm font-bold">Try again</button><Link href="/" className="rounded-full border border-[#183126]/12 bg-white px-6 py-3.5 text-sm font-bold">Back home</Link></div>
      </section>
    </main>
  );
}
