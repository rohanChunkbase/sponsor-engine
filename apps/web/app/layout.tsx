import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter_Tight } from "next/font/google";
import { Shell } from "@/components/shell";
import "./globals.css";

const sans = Inter_Tight({ subsets: ["latin"], variable: "--font-sans-family" });
const ui = Geist({ subsets: ["latin"], variable: "--font-ui-family" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono-family" });

export const metadata: Metadata = {
  title: "Sponsor Engine",
  description: "Front desk and sponsor list for London communities and venues.",
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
