import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FEEDR",
    short_name: "FEEDR",
    description: "Generate. Scroll. Pick winners.",
    start_url: "/",
    display: "standalone",
    background_color: "#0B0E11",
    theme_color: "#2EE6C9",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
