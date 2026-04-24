import "./globals.css";

export const metadata = {
  title: "NovaCentral",
  description: "Hybrid Crypto Earning Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="max-w-md mx-auto min-h-screen px-4 py-3">
          {children}
        </div>
      </body>
    </html>
  );
}