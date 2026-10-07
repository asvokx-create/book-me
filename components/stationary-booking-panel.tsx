"use client";

import { type CSSProperties, type ReactNode, useCallback, useLayoutEffect, useRef, useState } from "react";

const desktopQuery = "(min-width: 1024px)";
const pageInset = 24;
const viewportInset = 16;

function sameStyle(a: CSSProperties, b: CSSProperties) {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  return aKeys.length === bKeys.length && aKeys.every((key) => a[key as keyof CSSProperties] === b[key as keyof CSSProperties]);
}

export default function StationaryBookingPanel({ children }: { children: ReactNode }) {
  const columnRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pinnedTopRef = useRef<number | null>(null);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});

  const updatePosition = useCallback(() => {
    const column = columnRef.current;
    const panel = panelRef.current;
    const layout = column?.closest<HTMLElement>(".service-detail-layout");
    if (!column || !panel || !layout) return;

    if (!window.matchMedia(desktopQuery).matches) {
      pinnedTopRef.current = null;
      setPanelStyle((current) => sameStyle(current, {}) ? current : {});
      return;
    }

    const columnRect = column.getBoundingClientRect();
    const layoutRect = layout.getBoundingClientRect();
    const headerBottom = document.querySelector<HTMLElement>("[data-service-detail-header]")?.getBoundingClientRect().bottom ?? 0;

    if (pinnedTopRef.current === null) {
      pinnedTopRef.current = Math.max(panel.getBoundingClientRect().top, headerBottom + pageInset);
    }

    const top = pinnedTopRef.current;
    const maxHeight = Math.max(0, window.innerHeight - top - viewportInset);
    const naturalHeight = panel.scrollHeight;
    const visibleHeight = Math.min(naturalHeight, maxHeight);
    const needsPanelScroll = naturalHeight > maxHeight;
    const reachesListingEnd = columnRect.height >= visibleHeight && layoutRect.bottom <= top + visibleHeight;

    const nextStyle: CSSProperties = reachesListingEnd
      ? {
          position: "absolute",
          right: 0,
          bottom: 0,
          left: 0,
          width: "100%",
          maxHeight,
          overflowY: needsPanelScroll ? "auto" : "visible",
        }
      : {
          position: "fixed",
          top,
          left: columnRect.left,
          width: columnRect.width,
          maxHeight,
          overflowY: needsPanelScroll ? "auto" : "visible",
        };

    setPanelStyle((current) => sameStyle(current, nextStyle) ? current : nextStyle);
  }, []);

  useLayoutEffect(() => {
    let frame = 0;
    const scheduleUpdate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updatePosition);
    };
    const column = columnRef.current;
    const panel = panelRef.current;
    const header = document.querySelector<HTMLElement>("[data-service-detail-header]");
    const resizeObserver = new ResizeObserver(scheduleUpdate);
    if (column) resizeObserver.observe(column);
    if (panel) resizeObserver.observe(panel);
    if (header) resizeObserver.observe(header);
    const mutations = panel ? new MutationObserver(scheduleUpdate) : null;
    if (panel && mutations) mutations.observe(panel, { childList: true, subtree: true });

    updatePosition();
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      mutations?.disconnect();
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("scroll", scheduleUpdate);
    };
  }, [updatePosition]);

  return (
    <aside ref={columnRef} className="service-booking-column min-w-0">
      <div ref={panelRef} className="service-booking-panel min-w-0" style={panelStyle}>
        {children}
      </div>
    </aside>
  );
}
