"use client";

import { useState, useEffect, useMemo } from "react";

interface MarkdownWidgetProps {
  file: string;
  /** Show the file's translation, if it has one. */
  lang?: string;
  /** In the admin preview: skip the browser's cache (5 minutes), so saved files show at once. */
  fresh?: boolean;
}

export default function MarkdownWidget({ file, lang, fresh = false }: MarkdownWidgetProps) {
  const [html, setHtml] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const url = useMemo(() => `/api/markdown?file=${encodeURIComponent(file)}${lang ? `&lang=${lang}` : ""}`, [file, lang]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(url, fresh ? { cache: "no-store" } : undefined)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.html) {
          setHtml(data.html);
        } else {
          setError(data.error || "Markdown file not found");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load markdown");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [url, fresh]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="italic text-gray-500 dark:text-gray-400">
        {error}
      </p>
    );
  }

  return (
    <div
      className="prose prose-gray dark:prose-invert max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
