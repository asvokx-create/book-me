"use client";

import { useState } from "react";
import LocationFilter from "@/components/location-filter";
import ServiceSearchAssist from "@/components/service-search-assist";
import CustomSelect from "@/components/custom-select";

type HomeDeliveryFilter = "ALL" | "IN_PERSON" | "REMOTE";

const DELIVERY_OPTIONS = [
  { value: "ALL", label: "Any delivery type" },
  { value: "IN_PERSON", label: "In person" },
  { value: "REMOTE", label: "Remote" },
] as const;

function DeliveryIcon({ delivery }: { delivery: HomeDeliveryFilter }) {
  if (delivery === "IN_PERSON") return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z"/><circle cx="12" cy="10" r="2.2"/></svg>;
  if (delivery === "REMOTE") return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="8.5"/><path strokeLinecap="round" d="M3.8 12h16.4M12 3.5c2.3 2.4 3.4 5.2 3.4 8.5S14.3 18.1 12 20.5M12 3.5C9.7 5.9 8.6 8.7 8.6 12s1.1 6.1 3.4 8.5"/></svg>;
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M5 7h11m0 0-3-3m3 3-3 3M19 17H8m0 0 3 3m-3-3 3-3"/></svg>;
}

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
    <form action="/services" className="home-search-bar relative z-40 mt-12 flex w-full max-w-6xl flex-col gap-2 overflow-visible rounded-3xl border border-white bg-white/92 p-2.5 shadow-[0_24px_65px_rgba(24,49,38,.16)] backdrop-blur-xl lg:flex-row lg:items-center lg:rounded-full">
      <ServiceSearchAssist id="home-service-search" placeholder="What service do you need?" className="home-search-input flex flex-1 items-center rounded-full px-6 sm:px-7 xl:min-w-[300px]" inputClassName="w-full py-4 outline-none" iconClassName="home-search-icon mr-4 grid h-9 w-9 shrink-0 place-items-center rounded-full text-base" />

      <input type="hidden" name="delivery" value={delivery} />
      <div className="home-search-delivery-mobile" role="group" aria-label="Service delivery type">
        {(["ALL", "IN_PERSON", "REMOTE"] as const).map((option) => (
          <button key={option} type="button" aria-pressed={delivery === option} onClick={() => setDelivery(option)}>
            {option === "ALL" ? "All" : option === "IN_PERSON" ? "In person" : "Remote"}
          </button>
        ))}
      </div>

      <div className="home-search-delivery home-search-delivery-desktop relative flex min-h-14 items-center gap-3 rounded-full border border-[#183126]/10 bg-[#f6f8f3] px-5 lg:min-w-[190px] xl:min-w-[220px]">
        <span className="home-search-delivery-icon grid h-9 w-9 shrink-0 place-items-center rounded-full" aria-hidden="true"><DeliveryIcon delivery={delivery}/></span>
        <CustomSelect ariaLabel="Service delivery type" value={delivery} options={DELIVERY_OPTIONS} onChange={(value) => setDelivery(value as HomeDeliveryFilter)} className="min-w-0 flex-1" buttonClassName="home-search-delivery-select min-h-11 text-sm font-bold" menuClassName="w-56" />
      </div>

      {delivery !== "REMOTE" ? (
        <div className="home-search-location lg:min-w-[330px] xl:min-w-[365px]">
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
