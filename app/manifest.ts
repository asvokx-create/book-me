import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BubsBookings",
    short_name: "BubsBookings",
    description: "Find, message, and book local or remote service providers.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f7f3",
    theme_color: "#183126",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
