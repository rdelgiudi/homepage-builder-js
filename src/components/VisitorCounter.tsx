"use client";

import { useState, useEffect, useRef } from "react";
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
  /** Set once the server has pushed a live viewer count; the initial fetch must not overwrite it. */
  const gotLiveViewers = useRef(false);

  useEffect(() => {
    let cancelled = false;
    // Each counter is fetched on its own, so turning one off can't shift the other's response.
    const visitorsRequest = showVisitors ? fetch("/api/visitors", { method: "POST" }).then((r) => r.json()) : null;
    const viewersRequest = showViewers ? fetch("/api/viewers").then((r) => r.json()) : null;
    Promise.all([visitorsRequest, viewersRequest])
      .then(([visitorsData, viewersData]) => {
        if (cancelled) return;
        if (visitorsData?.count !== undefined) setCount(visitorsData.count);
        if (visitorsData?.visitorId) identifyVisitor(visitorsData.visitorId);
        if (viewersData?.count !== undefined && !gotLiveViewers.current) setViewers(viewersData.count);
      })
      .catch(() => {
        if (cancelled) return;
        setCount(null);
        setViewers(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Re-runs when a counter is switched on or off (live config refresh). Registering the
    // visitor again is harmless: the server counts each visitor once.
  }, [showViewers, showVisitors]);

  // Listen from the start: the page's shared socket (also used by ConfigSync) can connect
  // before the fetch above finishes, and the server announces the count only on changes.
  useWebSocket({
    enabled: showViewers,
    onMessage: (data) => {
      if (data && typeof data === "object" && (data as { type?: string }).type === "viewers") {
        const msg = data as { count?: number };
        if (typeof msg.count === "number") {
          gotLiveViewers.current = true;
          setViewers(msg.count);
        }
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
