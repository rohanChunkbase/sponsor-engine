import { Shell } from "@/components/shell";
import { raftAssets } from "@sponsor-engine/brand";
import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter_Tight } from "next/font/google";
import "./globals.css";

const sans = Inter_Tight({ subsets: ["latin"], variable: "--font-sans-family" });
const ui = Geist({ subsets: ["latin"], variable: "--font-ui-family" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono-family" });

export const metadata: Metadata = {
  title: "Sponsor Engine",
  description: "Front desk and sponsor list for London communities and venues.",
  icons: {
    icon: [
      { url: `/brand/${raftAssets.icon32}`, sizes: "32x32", type: "image/png" },
      { url: `/brand/${raftAssets.icon16}`, sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: `/brand/${raftAssets.icon180}`, sizes: "180x180" }],
  },
  manifest: `/brand/${raftAssets.manifest}`,
  openGraph: {
    images: [{ url: `/brand/${raftAssets.og}`, width: 1200, height: 630, alt: "Raft, the Sponsor Engine otter." }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${ui.variable} ${mono.variable}`}>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
