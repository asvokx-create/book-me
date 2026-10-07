"use client";

import { type CSSProperties, type ReactNode, useLayoutEffect, useRef, useState } from "react";

const desktopQuery = "(min-width: 1024px)";

function sameStyle(a: CSSProperties, b: CSSProperties) {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  return aKeys.length === bKeys.length && aKeys.every((key) => a[key as keyof CSSProperties] === b[key as keyof CSSProperties]);
}

export default function StationaryBookingPanel({ children }: { children: ReactNode }) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;

    const syncDock = () => {
      if (!window.matchMedia(desktopQuery).matches) {
        setPanelStyle((current) => sameStyle(current, {}) ? current : {});
        return;
      }

      const anchorRect = anchor.getBoundingClientRect();
      const top = 6 * parseFloat(getComputedStyle(document.documentElement).fontSize);
      const nextStyle: CSSProperties = anchorRect.top <= top
        ? { position: "fixed", top, left: anchorRect.left, width: anchorRect.width, zIndex: 40 }
        : {};

      setPanelStyle((current) => sameStyle(current, nextStyle) ? current : nextStyle);
    };

    const resizeObserver = new ResizeObserver(syncDock);
    resizeObserver.observe(anchor);
    syncDock();
    window.addEventListener("scroll", syncDock, { passive: true });
    window.addEventListener("resize", syncDock);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("scroll", syncDock);
      window.removeEventListener("resize", syncDock);
    };
  }, []);

  return (
    <div ref={anchorRef} className="min-w-0">
      <div ref={panelRef} className="service-booking-panel min-w-0" style={panelStyle}>
        {children}
      </div>
    </div>
  );
}
