"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownWidgetProps {
  file: string;
}

export default function MarkdownWidget({ file }: MarkdownWidgetProps) {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMarkdown() {
      try {
        const res = await fetch(`/api/markdown?file=${encodeURIComponent(file)}`);
        const data = await res.json();
        if (data.content) {
          setContent(data.content);
        } else {
          setContent("*Markdown file not found*");
        }
      } catch {
        setContent("*Failed to load markdown*");
      } finally {
        setLoading(false);
      }
    }
    fetchMarkdown();
  }, [file]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
      </div>
    );
  }

  return (
    <div className="prose prose-gray dark:prose-invert max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
