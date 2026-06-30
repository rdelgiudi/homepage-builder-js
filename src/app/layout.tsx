import type { Metadata } from "next";
import "./globals.css";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import fs from "fs";
import path from "path";

const CONFIG_PATH = path.join(process.cwd(), "src/config/homepage.json");

function loadConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    const config = JSON.parse(raw);
    return { name: config.name, tagline: config.tagline, favicon: config.favicon || "" };
  } catch {
    return { name: "My Homepage", tagline: "A customizable homepage with Discord status", favicon: "" };
  }
}

export function generateMetadata(): Metadata {
  const { name, tagline, favicon } = loadConfig();
  return {
    title: name,
    description: tagline,
    ...(favicon ? { icons: { icon: favicon } } : {}),
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
        <ThemeSwitcher />
      </body>
    </html>
  );
}
