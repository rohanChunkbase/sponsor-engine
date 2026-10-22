import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter_Tight } from "next/font/google";
import "./globals.css";

const sans = Inter_Tight({ subsets: ["latin"], variable: "--font-sans-family", display: "swap" });
const ui = Geist({ subsets: ["latin"], variable: "--font-ui-family", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono-family", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "Sponsor Engine",
    template: "%s · Sponsor Engine",
  },
  description: "Your community's front desk and sponsor desk, inside the agent you already use.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${ui.variable} ${mono.variable}`}>
      <body>
        <a className="skip" href="#content">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
