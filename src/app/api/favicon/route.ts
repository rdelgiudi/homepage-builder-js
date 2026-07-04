import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";

const FALLBACK_GRADIENT = ["#60a5fa", "#a78bfa", "#f472b6"];

function generateSvg(gradient: string[]): string {
  const colors = gradient.length > 0 ? gradient : FALLBACK_GRADIENT;
  const stops = colors
    .map((color, i) => `<stop offset="${(i / (colors.length - 1)) * 100}%" stop-color="${color}"/>`)
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">${stops}</linearGradient>
  </defs>
  <circle cx="16" cy="16" r="13" fill="none" stroke="url(#g)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <animateTransform attributeName="transform" type="rotate" from="0 16 16" to="360 16 16" dur="3s" repeatCount="indefinite"/>
  </circle>
  <circle cx="16" cy="3" r="2" fill="url(#g)">
    <animateTransform attributeName="transform" type="rotate" from="0 16 16" to="360 16 16" dur="3s" repeatCount="indefinite"/>
  </circle>
</svg>`;
}

let cachedSvg: string | null = null;
let cachedGradientKey = "";

export async function GET() {
  const config = getConfig();
  const colors = config.titleGradient || FALLBACK_GRADIENT;
  const key = colors.join(",");
  if (!cachedSvg || cachedGradientKey !== key) {
    cachedSvg = generateSvg(colors);
    cachedGradientKey = key;
  }
  return new NextResponse(cachedSvg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
