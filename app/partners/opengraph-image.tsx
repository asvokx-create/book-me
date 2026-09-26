import { ImageResponse } from "next/og";

export const alt = "BubsBookings Creator Partner Program";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", background: "#f8f7f3", color: "#183126", padding: "64px 72px", flexDirection: "column", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 30, fontWeight: 800 }}>
        <div style={{ display: "flex", width: 64, height: 64, borderRadius: 18, backgroundColor: "#183126", backgroundImage: 'url("https://bubsbookings.com/brand-icon.png")', backgroundPosition: "center", backgroundRepeat: "no-repeat", backgroundSize: "cover" }} />
        <div>BubsBookings</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", maxWidth: 1000 }}>
        <div style={{ display: "flex", color: "#61746a", fontSize: 24, fontWeight: 800, letterSpacing: 4, textTransform: "uppercase" }}>Creator Partner Program</div>
        <div style={{ display: "flex", marginTop: 18, fontSize: 62, lineHeight: 1.05, fontWeight: 800, letterSpacing: -3 }}>Help local providers grow. Earn when BubsBookings earns.</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 23, color: "#61746a" }}>
        <div>bubsbookings.com/partners</div>
        <div style={{ display: "flex", borderRadius: 999, background: "#eee25a", color: "#183126", padding: "13px 24px", fontWeight: 800 }}>Apply to become a partner</div>
      </div>
    </div>,
    size,
  );
}
