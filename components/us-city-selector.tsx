"use client";

import { useEffect, useRef, useState } from "react";

type CityChoice = { city: string; state: string; latitude: number; longitude: number; label: string; distance?: number };

export default function UsCitySelector({ value, onChange, className = "" }: { value: string; onChange: (value: string) => void; className?: string }) {
  const [nearby, setNearby] = useState<CityChoice[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CityChoice[]>([]);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/locations/cities?near=${encodeURIComponent(value)}`)
      .then((response) => response.json())
      .then((data: { cities?: CityChoice[] }) => { if (active) setNearby(data.cities ?? []); })
      .catch(() => { if (active) setNearby([]); });
    return () => { active = false; };
  }, [value]);

  useEffect(() => {
    if (!showAll) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      fetch(`/api/locations/cities?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((response) => response.json())
        .then((data: { cities?: CityChoice[] }) => setResults(data.cities ?? []))
        .catch((error: Error) => { if (error.name !== "AbortError") setResults([]); })
        .finally(() => setLoading(false));
    }, query ? 180 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, showAll]);

  function choose(label: string) {
    onChange(label);
    setShowAll(false);
    setQuery("");
  }

  return (
    <div>
      <select
        value={value}
        onChange={(event) => {
          if (event.target.value === "__all__") {
            setShowAll(true);
            window.setTimeout(() => searchRef.current?.focus(), 0);
            return;
          }
          choose(event.target.value);
        }}
        className={className}
      >
        <option value={value}>{value}</option>
        {nearby.map((city) => <option key={city.label} value={city.label}>{city.label}{typeof city.distance === "number" ? ` · ${city.distance} mi away` : ""}</option>)}
        <option value="__all__">View all U.S. cities…</option>
      </select>

      {showAll && <div className="fixed inset-0 z-[80] grid place-items-center bg-[#10251c]/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="city-picker-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowAll(false); }}>
        <div className="flex max-h-[82vh] w-full max-w-xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl">
          <div className="border-b border-[#183126]/10 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#718078]">Nationwide service areas</p><h2 id="city-picker-title" className="mt-1 text-2xl font-bold">Choose any U.S. city</h2></div><button type="button" onClick={() => setShowAll(false)} aria-label="Close city picker" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#183126]/15 text-xl hover:bg-[#edf2e9]">×</button></div>
            <label className="mt-5 block"><span className="sr-only">Search all U.S. cities</span><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by city or state, such as Austin, TX" className="w-full rounded-2xl border border-[#183126]/15 bg-[#faf9f5] px-4 py-3.5 outline-none focus:border-[#4d725d] focus:ring-2 focus:ring-[#4d725d]/10" /></label>
            <p className="mt-2 text-xs text-[#718078]">Search the nationwide U.S. Census places directory.</p>
          </div>
          <div className="min-h-48 overflow-y-auto p-3 sm:p-4">
            {loading ? <p className="p-5 text-center text-sm text-[#718078]">Finding cities…</p> : results.length ? <div className="grid gap-2 sm:grid-cols-2">{results.map((city) => <button key={city.label} type="button" onClick={() => choose(city.label)} className="rounded-xl border border-transparent px-4 py-3 text-left text-sm font-bold transition hover:border-[#8eaa91] hover:bg-[#edf3e7]">{city.label}</button>)}</div> : <p className="p-5 text-center text-sm text-[#718078]">No matching U.S. city was found.</p>}
          </div>
        </div>
      </div>}
    </div>
  );
}
