import type { Metadata } from "next";
import "./globals.css";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import FaviconAnimation from "@/components/FaviconAnimation";
import { getMetadata, getConfig } from "@/lib/config";

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
  const { titleGradient } = getMetadata();
  const faviconAnimation = getConfig().effects?.faviconAnimation ?? true;
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        {children}
        {faviconAnimation && <FaviconAnimation gradient={titleGradient} />}
        <ThemeSwitcher />
      </body>
    </html>
  );
}
