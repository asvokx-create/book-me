import { type ReactNode } from "react";

export default function StationaryBookingPanel({ children }: { children: ReactNode }) {
  return (
    <div className="service-booking-panel min-w-0 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto lg:overscroll-contain">
      {children}
    </div>
  );
}
