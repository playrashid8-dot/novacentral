import "../styles/globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NovaCentral",
  description: "Hybrid Crypto Earning Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={`${inter.className} bg-[#040406] text-white`}>

        {/* 🔥 GLOBAL APP WRAPPER */}
        <div className="min-h-screen glow-bg relative overflow-x-hidden">

          {/* 🌌 GRID BACKGROUND */}
          <div className="grid-bg" />

          {/* APP */}
          <div className="relative z-10">
            {children}
          </div>

        </div>

      </body>
    </html>
  );
}