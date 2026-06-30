"use client";

import { useState, useEffect, useMemo } from "react";

interface MarkdownWidgetProps {
  file: string;
}

export default function MarkdownWidget({ file }: MarkdownWidgetProps) {
  const [html, setHtml] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const url = useMemo(() => `/api/markdown?file=${encodeURIComponent(file)}`, [file]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(url)
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
  }, [url]);

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
