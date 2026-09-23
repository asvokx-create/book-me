"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { appendInternalPath, readInternalHistory, writeInternalHistory } from "@/lib/internal-navigation";

export default function InternalNavigationHistory() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialized = useRef(false);
  const navigatingBack = useRef(false);
  const query = searchParams.toString();
  const currentPath = `${pathname}${query ? `?${query}` : ""}`;

  useEffect(() => {
    const handlePopState = () => { navigatingBack.current = true; };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    let history = readInternalHistory();
    if (!initialized.current) {
      const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      const referrerIsInternal = (() => {
        if (!document.referrer) return false;
        try { return new URL(document.referrer).origin === window.location.origin; } catch { return false; }
      })();
      const isFreshExternalEntry = navigation?.type === "navigate" && !referrerIsInternal;
      history = appendInternalPath(history, currentPath, isFreshExternalEntry);
      initialized.current = true;
    } else if (navigatingBack.current) {
      const matchIndex = history.lastIndexOf(currentPath);
      history = matchIndex >= 0 ? history.slice(0, matchIndex + 1) : appendInternalPath(history, currentPath);
      navigatingBack.current = false;
    } else {
      history = appendInternalPath(history, currentPath);
    }
    writeInternalHistory(history);
  }, [currentPath]);

  return null;
}
