import { ImageResponse } from "next/og";
import { getServiceBySlug } from "@/lib/marketplace";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = await getServiceBySlug(slug);
  const title = service?.title ?? "Local services on BubsBookings";
  const provider = service?.provider ?? "BubsBookings";
  const location = service ? `${service.city}, ${service.state}` : "Local help, without the hassle";
  return new ImageResponse(
    <div style={{ display: "flex", height: "100%", width: "100%", background: "#f7f7f1", color: "#183126", padding: "70px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", width: "100%", flexDirection: "column", justifyContent: "space-between", borderRadius: "44px", background: "linear-gradient(135deg,#123d2b,#2f7750)", color: "white", padding: "58px 64px" }}>
        <div style={{ display: "flex", fontSize: 31, fontWeight: 800 }}><span>Bubs</span><span style={{ color: "#73d59b" }}>Bookings</span></div>
        <div style={{ display: "flex", flexDirection: "column" }}><div style={{ display: "flex", fontSize: 63, fontWeight: 800, letterSpacing: "-2px", lineHeight: 1.06 }}>{title}</div><div style={{ display: "flex", marginTop: 24, fontSize: 28, color: "#d8e9df" }}>{provider} · {location}</div></div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><span style={{ fontSize: 24, color: "#d8e9df" }}>View service details and request a booking</span><span style={{ borderRadius: 999, background: "#eee25a", color: "#183126", padding: "17px 28px", fontSize: 23, fontWeight: 800 }}>See listing →</span></div>
      </div>
    </div>,
    size,
  );
}

