"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { closestServiceArea, nearbyServiceAreas, serviceAreaLabel } from "@/lib/service-areas";
import RadiusSelector from "@/components/radius-selector";

type LocationFilterProps = {
  initialLocation?: string;
  initialRadius?: number;
  restoreRemembered?: boolean;
  autoSubmitRadius?: boolean;
};

const STORAGE_KEY = "bookme-service-area";

export default function LocationFilter({ initialLocation = "Issaquah, WA", initialRadius = 25, restoreRemembered = false, autoSubmitRadius = false }: LocationFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [location, setLocation] = useState(initialLocation);
  const [radius, setRadius] = useState(initialRadius);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState("");
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const radiusUpdateRef = useRef<number | null>(null);
  const nearby = useMemo(() => nearbyServiceAreas(location), [location]);
  const currentSearch = searchParams.toString();

  useEffect(() => {
    if (!restoreRemembered) return;
    const timer = window.setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as { location?: string; radius?: number } | null;
        if (!saved?.location) return;
        const savedRadius = Number.isInteger(saved.radius) && saved.radius! >= 1 && saved.radius! <= 250 ? saved.radius! : initialRadius;
        setLocation(saved.location);
        setRadius(savedRadius);
        if (pathname === "/services" && !new URLSearchParams(currentSearch).has("location")) {
          const params = new URLSearchParams(currentSearch);
          params.set("location", saved.location);
          params.set("radius", String(savedRadius));
          router.replace(`/services?${params.toString()}`, { scroll: false });
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [currentSearch, initialRadius, pathname, restoreRemembered, router]);

  useEffect(() => () => {
    if (radiusUpdateRef.current) window.clearTimeout(radiusUpdateRef.current);
  }, []);

  useEffect(() => {
    function closeWhenClickingOutside(event: PointerEvent) {
      const details = detailsRef.current;
      if (!details?.open || details.contains(event.target as Node)) return;
      details.open = false;
    }

    function closeWithEscape(event: KeyboardEvent) {
      if (event.key !== "Escape" || !detailsRef.current?.open) return;
      detailsRef.current.open = false;
      detailsRef.current.querySelector("summary")?.focus();
    }

    document.addEventListener("pointerdown", closeWhenClickingOutside);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("pointerdown", closeWhenClickingOutside);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, []);

  function remember(nextLocation: string, nextRadius: number) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ location: nextLocation, radius: nextRadius }));
  }

  function changeRadius(nextRadius: number) {
    setRadius(nextRadius);
    if (!Number.isInteger(nextRadius) || nextRadius < 1 || nextRadius > 250) return;
    remember(location, nextRadius);
    if (!autoSubmitRadius || pathname !== "/services") return;
    if (radiusUpdateRef.current) window.clearTimeout(radiusUpdateRef.current);
    radiusUpdateRef.current = window.setTimeout(() => {
      const params = new URLSearchParams(currentSearch);
      params.set("location", location);
      params.set("radius", String(nextRadius));
      params.delete("showFilters");
      router.push(`/services?${params.toString()}#service-listings`);
    }, 350);
  }

  function chooseLocation(nextLocation: string) {
    setLocation(nextLocation);
    remember(nextLocation, radius);
    setMessage("");
    if (detailsRef.current) detailsRef.current.open = false;
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setMessage("Current location is not available in this browser.");
      return;
    }
    setLocating(true);
    setMessage("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const closest = closestServiceArea(coords.latitude, coords.longitude);
        const closestLabel = serviceAreaLabel(closest);
        setLocation(closestLabel);
        remember(closestLabel, radius);
        setLocating(false);
        setMessage(`Using the nearest supported city: ${serviceAreaLabel(closest)}.`);
      },
      () => {
        setLocating(false);
        setMessage("We could not access your location. Search for your city instead.");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }

  return (
    <div className="relative flex min-w-0 flex-col gap-2 sm:flex-row">
      <input type="hidden" name="location" value={location} />
      <details ref={detailsRef} className="group relative min-w-0 flex-1">
        <summary className="flex min-h-12 list-none items-center gap-2 rounded-full px-4 text-left text-sm font-semibold transition hover:bg-[#edf3e7] [&::-webkit-details-marker]:hidden">
          <span aria-hidden="true">📍</span><span className="min-w-0 flex-1 truncate">{location}</span><span className="text-[#76857d] transition group-open:rotate-180">⌄</span>
        </summary>
        <div className="absolute left-0 top-full z-30 mt-3 w-[min(360px,calc(100vw-2.5rem))] rounded-[1.5rem] border border-[#183126]/10 bg-white p-5 shadow-[0_20px_55px_rgba(24,49,38,.18)]">
          <p className="text-xs font-bold uppercase tracking-[.14em] text-[#718078]">Choose your area</p>
          <label className="mt-4 block"><span className="sr-only">Enter city and state</span><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Enter city, state" className="w-full rounded-xl border border-[#183126]/15 bg-[#faf9f5] px-4 py-3 text-sm outline-none focus:border-[#4d725d]" /></label>
          <button type="button" onClick={useCurrentLocation} disabled={locating} className="mt-3 w-full rounded-xl border border-[#183126]/12 px-4 py-2.5 text-left text-sm font-bold transition hover:bg-[#edf3e7] disabled:opacity-60">◎ {locating ? "Finding your city…" : "Use my current location"}</button>
          {message && <p className="mt-2 text-xs leading-5 text-[#6c7d74]">{message}</p>}
          <p className="mt-5 text-xs font-bold text-[#718078]">Nearby cities</p>
          <div className="mt-2 grid grid-cols-2 gap-2">{nearby.map((area) => {
            const label = serviceAreaLabel(area);
            return <button key={label} type="button" onClick={() => chooseLocation(label)} className="rounded-xl px-3 py-2 text-left text-sm transition hover:bg-[#edf3e7]"><span className="block font-semibold">{area.city}</span><span className="text-[11px] text-[#7a8881]">{area.distance < 1 ? "Current city" : `${Math.round(area.distance)} mi away`}</span></button>;
          })}</div>
          <button type="button" onClick={() => chooseLocation(location.trim() || initialLocation)} className="mt-4 w-full rounded-xl bg-[#183126] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#294b3c]">Use this city</button>
        </div>
      </details>
      <div className="flex min-h-12 items-center gap-2 rounded-full border border-[#183126]/10 px-4 text-sm"><span className="whitespace-nowrap text-xs font-bold text-[#6e7f76]">Within</span><RadiusSelector name="radius" value={radius} onChange={changeRadius} compact /></div>
    </div>
  );
}
