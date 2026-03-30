import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ALDEA World — Demo",
  description: "ALDEA World demo with ALMA access control.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
