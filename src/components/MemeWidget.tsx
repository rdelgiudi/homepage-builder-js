"use client";

import { useState, useEffect } from "react";

interface Meme {
  title: string;
  url: string;
  postLink: string;
  subreddit: string;
  author: string;
  ups: number;
  nsfw: boolean;
}

interface MemeWidgetProps {
  enableGradientBorders?: boolean;
  widgetFrameEnabled?: boolean;
  widgetFrameWidth?: number;
  widgetFrameGradient?: string[];
}

export default function MemeWidget({ enableGradientBorders, widgetFrameEnabled, widgetFrameWidth, widgetFrameGradient }: MemeWidgetProps) {
  const [meme, setMeme] = useState<Meme | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchMeme() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const res = await fetch("/api/meme", { cache: "no-store" });
      const data = await res.json();
      if (data.url) {
        setMeme(data);
      }
    } catch (err) {
      console.error("Failed to fetch meme:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchMeme();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="w-full max-w-md h-64 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>
    );
  }

  if (!meme) {
    return (
      <div className="flex flex-col items-center gap-3">
        <p className="text-gray-500 dark:text-gray-400">Failed to load meme</p>
        <button
          onClick={fetchMeme}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className={`relative w-full max-w-md bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden${widgetFrameEnabled ? ' gradient-frame' : ''}`} style={widgetFrameEnabled ? { '--gf-width': `${widgetFrameWidth ?? 2}px`, '--gf-gradient': widgetFrameGradient?.length ? `linear-gradient(135deg, ${widgetFrameGradient.join(', ')})` : 'linear-gradient(135deg, #60a5fa, #a78bfa, #f472b6, #a78bfa, #60a5fa)' } as React.CSSProperties : undefined}>
        <img
          src={meme.url}
          alt={meme.title}
          className="w-full h-auto"
          loading="lazy"
        />
      </div>
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {meme.title}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          r/{meme.subreddit} • u/{meme.author} • ⬆ {meme.ups}
        </p>
      </div>
      <button
        onClick={fetchMeme}
        disabled={refreshing}
        className={`px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white rounded-lg transition-all text-sm flex items-center gap-2 hover:scale-105${enableGradientBorders ? ' gradient-border-card' : ''}`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
        </svg>
        {refreshing ? "Loading..." : "New Meme"}
      </button>
    </div>
  );
}
