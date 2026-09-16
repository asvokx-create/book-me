import { ImageResponse } from "next/og";
import { getGuide } from "@/lib/guides";

export const alt = "BubsBookings practical local-service guide";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuide(slug);
  const title = guide?.title ?? "BubsBookings Guide";
  const category = guide?.category ?? "Local service guidance";

  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", background: "#f8f7f3", color: "#183126", padding: "62px 70px", flexDirection: "column", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 30, fontWeight: 700 }}>
        <div style={{ display: "flex", width: 64, height: 64, borderRadius: 18, alignItems: "center", justifyContent: "center", background: "#183126", color: "#eee25a", fontSize: 32 }}>B</div>
        <div>BubsBookings Blog</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", maxWidth: 1030 }}>
        <div style={{ display: "flex", color: "#61746a", fontSize: 24, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" }}>{category}</div>
        <div style={{ display: "flex", marginTop: 20, fontSize: title.length > 54 ? 52 : 62, lineHeight: 1.08, fontWeight: 800, letterSpacing: -2 }}>{title}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 23, color: "#61746a" }}>
        <div>bubsbookings.com/guides</div>
        <div style={{ display: "flex", borderRadius: 999, background: "#eee25a", color: "#183126", padding: "12px 22px", fontWeight: 700 }}>Practical. Clear. Local.</div>
      </div>
    </div>,
    size,
  );
}
