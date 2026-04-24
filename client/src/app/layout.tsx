import "./globals.css";
import type { Metadata } from "next";

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
      <body className="bg-[#050507] text-white">
        {children}
      </body>
    </html>
  );
}