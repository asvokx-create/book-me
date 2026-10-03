"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function PartnerTermsLink() {
  const [hasPartnerTerms, setHasPartnerTerms] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/account/navigation", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<{ authenticated: boolean; isAffiliate: boolean }> : null)
      .then((result) => { if (active) setHasPartnerTerms(Boolean(result?.authenticated && result.isAffiliate)); })
      .catch(() => { if (active) setHasPartnerTerms(false); });
    return () => { active = false; };
  }, []);

  if (!hasPartnerTerms) return null;
  return <Link href="/affiliate#partner-terms" className="partner-terms-link mt-4 inline-flex min-h-11 items-center justify-center rounded-full border border-white/25 px-5 py-2.5 text-sm font-bold text-white transition hover:border-white/45 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#eee25a]/55">View my Partner terms</Link>;
}
