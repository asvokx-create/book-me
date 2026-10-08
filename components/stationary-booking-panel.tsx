import type { ReactNode } from "react";

export default function StationaryBookingPanel({ children }: { children: ReactNode }) {
  return <div className="service-booking-panel min-w-0">{children}</div>;
}
