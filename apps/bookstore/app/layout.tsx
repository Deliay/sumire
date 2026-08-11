import type { Metadata } from "next";
import { Cormorant_Garamond, Noto_Sans_SC, Noto_Serif_SC } from "next/font/google";
import Footer from "@/components/Footer";
import NavBar from "@/components/NavBar";
import { getSite } from "@/lib/content";
import { getTools } from "@/lib/tools/registry";
import "./globals.css";

const notoSerifSC = Noto_Serif_SC({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-noto-serif-sc",
});

const notoSansSC = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-sans-sc",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
});

const site = getSite();

export const metadata: Metadata = {
  title: {
    default: `${site.name} · ${site.tagline}`,
    template: `%s · ${site.name}`,
  },
  description: site.description,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="zh-CN"
      className={`${notoSerifSC.variable} ${notoSansSC.variable} ${cormorant.variable}`}
    >
      <body className="bg-night font-sans text-ink antialiased">
        <NavBar siteName={site.name} tools={getTools()} />
        <main className="min-h-svh">{children}</main>
        <Footer site={site} />
      </body>
    </html>
  );
}
