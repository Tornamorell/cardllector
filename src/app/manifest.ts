import type { MetadataRoute } from "next";

// Makes the app installable on the phone ("Añadir a pantalla de inicio"), so the scanner
// opens full screen like a native app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tapmat",
    short_name: "Tapmat",
    description: "Tu colección de cartas, con precio.",
    start_url: "/",
    display: "standalone",
    background_color: "#16142b",
    theme_color: "#16142b",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
