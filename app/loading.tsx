export default function Loading() {
  return (
    <main className="grid min-h-[70vh] place-items-center bg-[#f8f7f3] px-5 text-[#183126]" aria-busy="true" aria-label="Loading page">
      <div className="w-full max-w-lg rounded-[2rem] border border-[#183126]/8 bg-white/80 p-8 shadow-[0_22px_65px_rgba(19,46,35,.1)] backdrop-blur">
        <div className="h-3 w-24 animate-pulse rounded-full bg-[#dfe8dc]" />
        <div className="mt-5 h-10 w-4/5 animate-pulse rounded-xl bg-[#d7e2d4]" />
        <div className="mt-4 h-4 w-full animate-pulse rounded-full bg-[#e6ebe3]" />
        <div className="mt-2 h-4 w-2/3 animate-pulse rounded-full bg-[#e6ebe3]" />
        <div className="mt-8 h-12 w-36 animate-pulse rounded-full bg-[#eee25a]/70" />
        <p className="sr-only">Loading BubsBookings…</p>
      </div>
    </main>
  );
}
