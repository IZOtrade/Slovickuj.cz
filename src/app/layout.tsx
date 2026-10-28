import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Slovickuj.cz — angličtina po malých krocích",
  description: "Osobní slovníčky, chytré opakování a výslovnost na jednom místě.",
  applicationName: "Slovíčkuj.cz",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: { capable: true, title: "Slovíčkuj", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#ef1823", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="cs"><body>{children}</body></html>;
}
