import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Slovickuj.cz — angličtina po malých krocích",
  description: "Osobní slovníčky, chytré opakování a výslovnost na jednom místě.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="cs"><body>{children}</body></html>;
}
