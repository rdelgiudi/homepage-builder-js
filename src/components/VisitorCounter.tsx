"use client";

import { useState, useEffect } from "react";
import { useWebSocket, sendWebSocket } from "@/hooks/useWebSocket";

interface VisitorCounterProps {
  showViewers?: boolean;
  showVisitors?: boolean;
}

export default function VisitorCounter({
  showViewers = true,
  showVisitors = true,
}: VisitorCounterProps) {
  const [viewers, setViewers] = useState<number | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function trackAndGetCount() {
      try {
        const requests: Promise<Response>[] = [];
        if (showVisitors) requests.push(fetch("/api/visitors", { method: "POST" }));
        if (showViewers) requests.push(fetch("/api/viewers"));
        const [visitorsRes, viewersRes] = await Promise.all(requests);
        if (visitorsRes) {
          const visitorsData = await visitorsRes.json();
          if (visitorsData.count !== undefined) setCount(visitorsData.count);
          if (visitorsData.visitorId) identifyVisitor(visitorsData.visitorId);
        }
        if (viewersRes) {
          const viewersData = await viewersRes.json();
          if (viewersData.count !== undefined) setViewers(viewersData.count);
        }
      } catch {
        setCount(null);
        setViewers(null);
      } finally {
        setLoading(false);
      }
    }
    trackAndGetCount();
  }, []);

  useWebSocket({
    enabled: !loading && showViewers,
    onMessage: (data) => {
      if (data && typeof data === "object" && (data as { type?: string }).type === "viewers") {
        const msg = data as { count?: number };
        if (typeof msg.count === "number") setViewers(msg.count);
      }
    },
  });

  function identifyVisitor(visitorId: string) {
    let attempts = 0;
    const trySend = () => {
      if (sendWebSocket({ type: "identify", visitorId })) return;
      if (attempts++ < 50) setTimeout(trySend, 100);
    };
    trySend();
  }

  if (!showViewers && !showVisitors) return null;

  if (loading || (showVisitors && count === null) || (showViewers && viewers === null)) {
    return (
      <div className="flex flex-col gap-1 text-gray-500 dark:text-gray-400">
        <span className="text-sm">...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 text-gray-500 dark:text-gray-400">
      {showViewers && (
        <div className="flex items-center gap-2">
          <span className="text-base">🔴</span>
          <span className="text-sm">
            {viewers !== null ? viewers.toLocaleString() : "—"} {viewers === 1 ? "person" : "people"} viewing now
          </span>
        </div>
      )}
      {showVisitors && (
        <div className="flex items-center gap-2">
          <span className="text-lg">👁</span>
          <span className="text-sm">{count!.toLocaleString()} unique visitors</span>
        </div>
      )}
    </div>
  );
}
