"use client";

import { type CSSProperties, type ReactNode, useLayoutEffect, useRef, useState } from "react";

type PinnedPosition = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export default function StationaryBookingPanel({ children }: { children: ReactNode }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pinnedPosition, setPinnedPosition] = useState<PinnedPosition | null>(null);

  useLayoutEffect(() => {
    const desktopViewport = window.matchMedia("(min-width: 1024px)");
    let initialPosition: Omit<PinnedPosition, "height"> | null = null;
    let animationFrame = 0;

    const syncPosition = () => {
      const frame = frameRef.current;
      const panel = panelRef.current;

      if (!desktopViewport.matches || !frame || !panel) {
        initialPosition = null;
        setPinnedPosition(null);
        return;
      }

      const panelBounds = panel.getBoundingClientRect();
      initialPosition ??= {
        top: panelBounds.top,
        left: panelBounds.left,
        width: panelBounds.width,
      };
      const nextPosition = {
        ...initialPosition,
        height: panel.offsetHeight,
      };

      setPinnedPosition((currentPosition) => (
        currentPosition
        && currentPosition.top === nextPosition.top
        && currentPosition.left === nextPosition.left
        && currentPosition.width === nextPosition.width
        && currentPosition.height === nextPosition.height
          ? currentPosition
          : nextPosition
      ));
    };

    const scheduleSync = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(syncPosition);
    };

    const resetPosition = () => {
      initialPosition = null;
      setPinnedPosition(null);
      scheduleSync();
    };

    const resizeObserver = new ResizeObserver(scheduleSync);
    if (frameRef.current) resizeObserver.observe(frameRef.current);
    if (panelRef.current) resizeObserver.observe(panelRef.current);
    desktopViewport.addEventListener("change", resetPosition);
    window.addEventListener("resize", resetPosition);
    syncPosition();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      desktopViewport.removeEventListener("change", resetPosition);
      window.removeEventListener("resize", resetPosition);
    };
  }, []);

  const panelStyle: CSSProperties | undefined = pinnedPosition
    ? {
        position: "fixed",
        top: pinnedPosition.top,
        left: pinnedPosition.left,
        width: pinnedPosition.width,
        zIndex: 30,
      }
    : undefined;

  return (
    <div ref={frameRef} className="service-booking-panel min-w-0" style={pinnedPosition ? { minHeight: pinnedPosition.height } : undefined}>
      <div ref={panelRef} className="min-w-0" style={panelStyle}>
        {children}
      </div>
    </div>
  );
}
