"use client";

import { type ReactNode, useLayoutEffect, useRef } from "react";

export default function StationaryBookingPanel({ children }: { children: ReactNode }) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;

    const anchorElement: HTMLDivElement = anchor;
    const panelElement: HTMLDivElement = panel;

    let frame = 0;
    function updatePosition() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const anchorRect = anchorElement.getBoundingClientRect();
        const panelHeight = panelElement.offsetHeight;
        const desktop = window.matchMedia("(min-width: 1024px)").matches;
        const fitsViewport = panelHeight + 32 <= window.innerHeight;
        const anchorTop = anchorRect.top + window.scrollY;
        const fixed = desktop && fitsViewport && window.scrollY >= anchorTop - 16;

        anchorElement.style.minHeight = desktop ? `${panelHeight}px` : "";
        if (fixed) {
          panelElement.style.position = "fixed";
          panelElement.style.top = "16px";
          panelElement.style.left = `${anchorRect.left}px`;
          panelElement.style.width = `${anchorRect.width}px`;
          panelElement.style.zIndex = "30";
        } else {
          panelElement.style.position = "";
          panelElement.style.top = "";
          panelElement.style.left = "";
          panelElement.style.width = "";
          panelElement.style.zIndex = "";
        }
      });
    }

    const resizeObserver = new ResizeObserver(updatePosition);
    resizeObserver.observe(panelElement);
    window.addEventListener("scroll", updatePosition, { passive: true });
    window.addEventListener("resize", updatePosition);
    updatePosition();

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener("scroll", updatePosition);
      window.removeEventListener("resize", updatePosition);
      anchorElement.style.minHeight = "";
      panelElement.removeAttribute("style");
    };
  }, []);

  return <div ref={anchorRef} className="min-w-0"><div ref={panelRef} className="service-booking-panel">{children}</div></div>;
}
