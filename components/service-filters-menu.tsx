"use client";

import { useEffect, useRef, type ReactNode } from "react";

export default function ServiceFiltersMenu({
  initiallyOpen,
  children,
}: {
  initiallyOpen: boolean;
  children: ReactNode;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

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

  return (
    <details ref={detailsRef} open={initiallyOpen} className="group shrink-0">
      {children}
    </details>
  );
}
