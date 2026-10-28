import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Slovíčkuj.cz",
    short_name: "Slovíčkuj",
    description: "Vlastní slovíčka, rychlé opakování a výslovnost.",
    lang: "cs",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f3f5f8",
    theme_color: "#ef1823",
    prefer_related_applications: false,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
