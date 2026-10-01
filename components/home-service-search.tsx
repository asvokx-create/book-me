"use client";

import { useState } from "react";
import LocationFilter from "@/components/location-filter";
import ServiceSearchAssist from "@/components/service-search-assist";

type HomeDeliveryFilter = "ALL" | "IN_PERSON" | "REMOTE";

export default function HomeServiceSearch({
  initialDelivery = "ALL",
  initialLocation,
  initialRadius,
  restoreRemembered,
}: {
  initialDelivery?: HomeDeliveryFilter;
  initialLocation: string;
  initialRadius: number;
  restoreRemembered: boolean;
}) {
  const [delivery, setDelivery] = useState<HomeDeliveryFilter>(initialDelivery);

  return (
    <form action="/services" className="home-search-bar relative z-40 mt-12 flex max-w-5xl flex-col gap-2 overflow-visible rounded-3xl border border-white bg-white/92 p-2.5 shadow-[0_24px_65px_rgba(24,49,38,.16)] backdrop-blur-xl lg:flex-row lg:items-center lg:rounded-full">
      <ServiceSearchAssist id="home-service-search" placeholder="What service do you need?" className="home-search-input flex flex-1 items-center rounded-full px-6 sm:px-7" inputClassName="w-full py-4 outline-none" iconClassName="home-search-icon mr-4 grid h-9 w-9 shrink-0 place-items-center rounded-full text-base" />

      <label className="home-search-delivery flex min-h-14 items-center gap-3 rounded-full border border-[#183126]/10 bg-[#f6f8f3] px-5 lg:min-w-[190px]">
        <span aria-hidden="true">◉</span>
        <span className="sr-only">Service delivery type</span>
        <select name="delivery" value={delivery} onChange={(event) => setDelivery(event.target.value as HomeDeliveryFilter)} className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none">
          <option value="ALL">Any delivery type</option>
          <option value="IN_PERSON">In person</option>
          <option value="REMOTE">Remote</option>
        </select>
      </label>

      {delivery !== "REMOTE" ? (
        <div className="home-search-location lg:min-w-[330px]">
          <LocationFilter initialLocation={initialLocation} initialRadius={initialRadius} restoreRemembered={restoreRemembered} autoSubmitLocation autoSubmitRadius requestLocationOnFirstVisit />
        </div>
      ) : (
        <div className="flex min-h-14 items-center rounded-full bg-[#edf3e7] px-5 text-sm font-bold text-[#4f695a] lg:min-w-[250px]">🌐 Search without a distance limit</div>
      )}

      <button type="submit" className="home-search-submit rounded-full bg-[#eee25a] px-8 py-4 font-bold text-[#183126] transition hover:bg-[#f5ea6b]">
        Find a pro
      </button>
    </form>
  );
}
