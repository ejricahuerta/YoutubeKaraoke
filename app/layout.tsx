import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-bricolage" });
const sans = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: "700", variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "YouOke",
  authors: [{ name: "edmel.dev", url: "https://edmel.dev" }],
  description: "YouOke: karaoke night with a shared queue: play YouTube karaoke videos on the big screen and add songs from your phone.",
};

export const viewport: Viewport = { themeColor: "#0b0a10", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Browser extensions add attributes to <html> (Scribe's data-scribe-recorder-ready) and
    // <body> (Grammarly's data-gr-*) before React hydrates. This silences attribute mismatches
    // on these two tags only; their children are still checked.
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
