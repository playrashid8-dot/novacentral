import "../styles/globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "HybridEarn",
  description: "HybridEarn premium crypto earning platform with ROI, referrals, VIP rewards, and staking.",
  icons: {
    icon: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body
        className={`${inter.className} bg-[#040406] text-white antialiased`}
      >

        {/* 🔥 GLOBAL WRAPPER */}
        <div className="min-h-screen relative overflow-x-hidden">

          {/* 🌌 BACKGROUND GLOW (OPTIMIZED) */}
          <div className="pointer-events-none absolute w-[520px] h-[520px] bg-purple-600/25 blur-[150px] top-[-170px] left-[-180px]" />
          <div className="pointer-events-none absolute w-[520px] h-[520px] bg-indigo-600/25 blur-[150px] bottom-[-170px] right-[-180px]" />
          <div className="pointer-events-none absolute w-[320px] h-[320px] bg-fuchsia-500/10 blur-[120px] top-1/3 left-1/2 -translate-x-1/2" />

          {/* 🔲 GRID */}
          <div className="pointer-events-none absolute inset-0 grid-bg" />

          {/* 📱 APP CONTAINER */}
          <main className="relative z-10 max-w-[460px] mx-auto px-3 sm:px-4">
            {children}
          </main>

        </div>

      </body>
    </html>
  );
}