import "./globals.css";
import BottomNav from "../components/BottomNav";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

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
    <html lang="en">
      <body
        className={`${inter.className} bg-[#050507] text-white antialiased`}
      >
        {/* MAIN APP WRAPPER */}
        <div className="min-h-screen flex flex-col">

          {/* CONTENT */}
          <main className="flex-1 pb-24">
            {children}
          </main>

          {/* BOTTOM NAV */}
          <BottomNav />

        </div>
      </body>
    </html>
  );
}