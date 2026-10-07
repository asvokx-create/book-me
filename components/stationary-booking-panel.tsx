import { type ReactNode } from "react";

export default function StationaryBookingPanel({ children }: { children: ReactNode }) {
  return (
    <div className="service-booking-panel min-w-0 lg:sticky lg:top-40">
      {children}
    </div>
  );
}
