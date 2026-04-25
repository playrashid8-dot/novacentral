import "../styles/globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  display: "swap", // 🔥 better performance
});

export const metadata: Metadata = {
  title: "NovaCentral",
  description: "Hybrid Crypto Earning Platform",
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

          {/* 🌌 BACKGROUND GLOW */}
          <div className="pointer-events-none absolute w-[500px] h-[500px] bg-purple-600 opacity-20 blur-[150px] top-[-150px] left-[-150px]" />
          <div className="pointer-events-none absolute w-[500px] h-[500px] bg-indigo-600 opacity-20 blur-[150px] bottom-[-150px] right-[-150px]" />

          {/* 🔲 GRID */}
          <div className="grid-bg pointer-events-none" />

          {/* 📱 APP CONTAINER */}
          <main className="relative z-10 max-w-[420px] mx-auto">
            {children}
          </main>

        </div>

      </body>
    </html>
  );
}