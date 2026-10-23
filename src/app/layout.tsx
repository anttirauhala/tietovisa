import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Pikkujouluvisa",
  description:
    "Kahoot-tyylinen reaaliaikainen tietovisa pikkujouluihin: juontaja projektorille, pelaajat omille puhelimille.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#2b1055",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fi" className="h-full">
      <body className="flex min-h-full flex-col font-sans antialiased">{children}</body>
    </html>
  );
}
