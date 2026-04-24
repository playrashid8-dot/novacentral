import "./globals.css";
import BottomNav from "./components/BottomNav";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>

        {/* APP WRAPPER */}
        <div className="max-w-md mx-auto min-h-screen px-3 pb-24">

          {/* HEADER */}
          <div className="flex justify-between items-center py-4">
            <h1 className="text-lg font-bold">🚀 NovaCentral</h1>
            <span className="text-sm text-gray-400">Dashboard</span>
          </div>

          {/* MAIN CONTENT */}
          {children}

        </div>

        {/* BOTTOM NAV */}
        <BottomNav />

      </body>
    </html>
  );
}