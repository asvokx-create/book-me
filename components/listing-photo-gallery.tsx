"use client";

import type { ReactNode, TouchEvent } from "react";
import { useEffect, useRef, useState } from "react";

type ListingPhotoGalleryProps = {
  images: string[];
  title: string;
  fallbackGradient: string;
  fallbackArt: string;
  children?: ReactNode;
};

export default function ListingPhotoGallery({ images, title, fallbackGradient, fallbackArt, children }: ListingPhotoGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const touchStart = useRef<number | null>(null);
  const hasMultiple = images.length > 1;

  function show(index: number) {
    if (!images.length) return;
    setSelectedIndex((index + images.length) % images.length);
  }

  function previous() {
    show(selectedIndex - 1);
  }

  function next() {
    show(selectedIndex + 1);
  }

  function startSwipe(event: TouchEvent) {
    touchStart.current = event.changedTouches[0]?.clientX ?? null;
  }

  function finishSwipe(event: TouchEvent) {
    if (touchStart.current === null) return;
    const distance = (event.changedTouches[0]?.clientX ?? touchStart.current) - touchStart.current;
    touchStart.current = null;
    if (Math.abs(distance) < 45) return;
    if (distance > 0) previous();
    else next();
  }

  useEffect(() => {
    if (!viewerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setViewerOpen(false);
      if (event.key === "ArrowLeft") previous();
      if (event.key === "ArrowRight") next();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  });

  if (!images.length) {
    return (
      <div className={`relative h-72 overflow-hidden rounded-[2.5rem] bg-gradient-to-br sm:h-[420px] ${fallbackGradient}`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_25%,rgba(255,255,255,.4),transparent_28%)]" />
        <div className="absolute bottom-[-40%] left-[18%] h-[90%] w-[80%] rounded-[50%] border-[36px] border-white/20" />
        <span className="absolute bottom-8 right-10 text-8xl opacity-80 sm:text-9xl">{fallbackArt}</span>
        {children}
      </div>
    );
  }

  const selectedImage = images[selectedIndex];
  const mainImageStyle = { backgroundImage: `url("${selectedImage}")` };

  return (
    <section aria-label={`${title} photo gallery`}>
      <div
        className="group relative h-72 touch-pan-y overflow-hidden rounded-[2.5rem] bg-[#e5e8e2] bg-cover bg-center shadow-[0_16px_45px_rgba(24,49,38,.1)] sm:h-[420px]"
        style={mainImageStyle}
        onTouchStart={startSwipe}
        onTouchEnd={finishSwipe}
      >
        <button type="button" onClick={() => setViewerOpen(true)} aria-label={`Open photo ${selectedIndex + 1} of ${images.length} in full screen`} className="absolute inset-0 z-0 cursor-zoom-in focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-[#eee25a]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-24 bg-gradient-to-t from-black/35 to-transparent" />
        {children}
        {hasMultiple && <>
          <button type="button" onClick={previous} aria-label="Previous photo" className="absolute left-3 top-1/2 z-20 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/40 bg-white/90 text-xl font-bold text-[#183126] shadow-lg backdrop-blur transition hover:bg-white hover:shadow-xl sm:left-5">‹</button>
          <button type="button" onClick={next} aria-label="Next photo" className="absolute right-3 top-1/2 z-20 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/40 bg-white/90 text-xl font-bold text-[#183126] shadow-lg backdrop-blur transition hover:bg-white hover:shadow-xl sm:right-5">›</button>
        </>}
        <span className="absolute bottom-4 right-4 z-20 rounded-full bg-black/65 px-3 py-1.5 text-xs font-bold text-white backdrop-blur">{selectedIndex + 1} / {images.length}</span>
      </div>

      {hasMultiple && <div className="mobile-scroll-row mt-3 flex gap-3 overflow-x-auto pb-1" aria-label="Choose a listing photo">
        {images.map((url, index) => <button key={`${url}-${index}`} type="button" aria-label={`Show photo ${index + 1} of ${images.length}`} aria-pressed={selectedIndex === index} onClick={() => show(index)} style={{ backgroundImage: `url("${url}")` }} className={`relative aspect-[4/3] w-28 shrink-0 overflow-hidden rounded-2xl border-2 bg-[#e5e8e2] bg-cover bg-center transition sm:w-36 ${selectedIndex === index ? "border-[#183126] ring-4 ring-[#eee25a]/70" : "border-transparent opacity-80 hover:border-[#6e8878] hover:opacity-100"}`}><span className="sr-only">{selectedIndex === index ? "Currently selected" : `Select photo ${index + 1}`}</span></button>)}
      </div>}
      <p aria-live="polite" className="sr-only">Showing photo {selectedIndex + 1} of {images.length}</p>

      {viewerOpen && <div role="dialog" aria-modal="true" aria-label={`${title} full-screen photo viewer`} className="fixed inset-0 z-[120] flex items-center justify-center bg-[#06140e]/95 p-3 backdrop-blur-md sm:p-8" onMouseDown={(event) => { if (event.target === event.currentTarget) setViewerOpen(false); }} onTouchStart={startSwipe} onTouchEnd={finishSwipe}>
        <button type="button" onClick={() => setViewerOpen(false)} aria-label="Close photo viewer" className="absolute right-4 top-4 z-20 grid h-12 w-12 place-items-center rounded-full border border-white/20 bg-white/10 text-2xl text-white hover:bg-white/20 sm:right-7 sm:top-7">×</button>
        {hasMultiple && <><button type="button" onClick={previous} aria-label="Previous photo" className="absolute left-3 top-1/2 z-20 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-2xl font-bold text-[#183126] shadow-xl hover:bg-white sm:left-7">‹</button><button type="button" onClick={next} aria-label="Next photo" className="absolute right-3 top-1/2 z-20 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-2xl font-bold text-[#183126] shadow-xl hover:bg-white sm:right-7">›</button></>}
        <div role="img" aria-label={`${title} photo ${selectedIndex + 1} of ${images.length}`} style={{ backgroundImage: `url("${selectedImage}")` }} className="h-[82vh] w-full max-w-7xl bg-contain bg-center bg-no-repeat" />
        <span className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-4 py-2 text-sm font-bold text-white">{selectedIndex + 1} / {images.length}</span>
      </div>}
    </section>
  );
}
