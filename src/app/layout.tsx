import type { Metadata } from "next";
import "./globals.css";
import { getMetadata } from "@/lib/config";

export function generateMetadata(): Metadata {
  const { name, tagline, favicon } = getMetadata();
  return {
    title: name,
    description: tagline,
    icons: { icon: favicon || "/api/favicon" },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
