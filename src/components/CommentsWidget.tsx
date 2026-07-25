"use client";

import { useState, useEffect, useCallback } from "react";

interface Comment {
  id: number;
  name: string;
  body: string;
  created_at: string;
}

interface CommentsWidgetProps {
  limit?: number;
  enableGradientBorders?: boolean;
}

export default function CommentsWidget({ limit = 50, enableGradientBorders }: CommentsWidgetProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/comments?limit=${limit}`);
      const data = await res.json();
      if (data.comments) {
        setComments(data.comments);
      } else {
        setError(data.error || "Failed to load comments");
      }
    } catch {
      setError("Failed to load comments");
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const trimmedName = name.trim();
    const trimmedBody = body.trim();
    if (!trimmedName || !trimmedBody) {
      setFormError("Name and comment are required.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, body: trimmedBody }),
      });
      const data = await res.json();
      if (res.ok && data.comment) {
        setComments((prev) => [data.comment as Comment, ...prev].slice(0, limit));
        setBody("");
        setFormError(null);
      } else {
        setFormError(data.error || "Failed to post comment.");
      }
    } catch {
      setFormError("Failed to post comment.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = `w-full px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500/50${enableGradientBorders ? " gradient-border-card" : " border border-gray-300 dark:border-gray-600"}`;
  const buttonClass = `px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:scale-105${enableGradientBorders ? " gradient-border-card" : ""}`;

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className={inputClass}
          disabled={submitting}
        />
        <textarea
          value={body}
          maxLength={500}
          rows={3}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Leave a comment..."
          className={`${inputClass} resize-y`}
          disabled={submitting}
        />
        <div className="flex items-center gap-3">
          <button type="submit" className={buttonClass} disabled={submitting}>
            {submitting ? "Posting..." : "Post Comment"}
          </button>
          {formError && (
            <span className="text-sm text-red-500 dark:text-red-400">{formError}</span>
          )}
        </div>
      </form>

      {loading && (
        <div className="animate-pulse space-y-3">
          <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg w-full" />
          <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg w-5/6" />
        </div>
      )}

      {!loading && error && (
        <p className="italic text-gray-500 dark:text-gray-400">{error}</p>
      )}

      {!loading && !error && comments.length === 0 && (
        <p className="italic text-gray-500 dark:text-gray-400">No comments yet. Be the first!</p>
      )}

      {!loading && !error && comments.length > 0 && (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li
              key={c.id}
              className={`p-4 rounded-lg bg-gray-100 dark:bg-gray-800${enableGradientBorders ? " gradient-border-card" : ""}`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold text-gray-900 dark:text-white truncate">{c.name}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                  {new Date(c.created_at).toLocaleString()}
                </span>
              </div>
              <p className="mt-1 text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                {c.body}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
