"use client";

import { useState, useEffect } from "react";

export default function VisitorCounter() {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function trackAndGetCount() {
      try {
        const res = await fetch("/api/visitors", { method: "POST" });
        const data = await res.json();
        if (data.count !== undefined) {
          setCount(data.count);
        }
      } catch {
        setCount(null);
      } finally {
        setLoading(false);
      }
    }
    trackAndGetCount();
  }, []);

  if (loading || count === null) {
    return (
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
        <span className="text-lg">👁</span>
        <span className="text-sm">...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
      <span className="text-lg">👁</span>
      <span className="text-sm">{count.toLocaleString()} unique visitors</span>
    </div>
  );
}
