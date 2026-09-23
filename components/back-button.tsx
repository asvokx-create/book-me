"use client";

import { useRouter } from "next/navigation";
import { isSafeInternalPath, readInternalHistory, rewindInternalHistory, writeInternalHistory } from "@/lib/internal-navigation";

type BackButtonProps = {
  label?: string;
  fallbackHref: string;
  preserveInternalHistory?: boolean;
  className?: string;
};

export default function BackButton({ label = "Back", fallbackHref, preserveInternalHistory = true, className = "" }: BackButtonProps) {
  const router = useRouter();

  function goBack() {
    const currentPath = `${window.location.pathname}${window.location.search}`;
    const rewound = rewindInternalHistory(readInternalHistory(), currentPath);
    if (preserveInternalHistory && rewound.previous && window.history.length > 1) {
      writeInternalHistory(rewound.history);
      router.back();
      return;
    }
    router.push(isSafeInternalPath(fallbackHref) ? fallbackHref : "/");
  }

  return (
    <button
      type="button"
      onClick={goBack}
      className={`back-button inline-flex min-h-11 min-w-11 max-w-full shrink-0 items-center justify-center gap-2 rounded-full border border-[#183126]/12 bg-white px-4 py-2.5 text-left text-sm font-bold text-[#52695d] shadow-[0_3px_12px_rgba(24,49,38,.04)] transition-colors hover:border-[#557463] hover:bg-[#e7efe3] hover:text-[#183126] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#34704a] ${className}`}
      aria-label={label}
    >
      <span aria-hidden="true" className="shrink-0 text-base">←</span>
      <span className="back-button-label min-w-0">{label}</span>
    </button>
  );
}
