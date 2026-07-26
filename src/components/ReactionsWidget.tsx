"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { DEFAULT_EMOJIS } from "@/lib/reactions";

interface ReactionCount {
  emoji: string;
  count: number;
}

interface ReactionsResponse {
  counts?: ReactionCount[];
  reacted?: string[];
}

interface ReactionsWidgetProps {
  emojis?: string[];
  enableGradientBorders?: boolean;
}

export default function ReactionsWidget({
  emojis = DEFAULT_EMOJIS,
  enableGradientBorders,
}: ReactionsWidgetProps) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [reacted, setReacted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);

  // Refs mirror the latest values so click handlers never read stale state.
  const reactedRef = useRef<Set<string>>(new Set());

  function updateReacted(next: Set<string>) {
    reactedRef.current = next;
    setReacted(next);
  }

  function applyCounts(data: ReactionsResponse) {
    if (data.counts) {
      const map: Record<string, number> = {};
      for (const c of data.counts) map[c.emoji] = c.count;
      setCounts(map);
    }
    if (data.reacted) updateReacted(new Set(data.reacted));
  }

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/reactions");
      const data = await res.json();
      applyCounts(data);
    } catch {
      // ignore — counts stay at 0, nothing marked as reacted
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Matches RATE_LIMIT_MS on the server. On a 429 we wait out the window and
  // retry so the visitor's intent is honored instead of being dropped.
  const RATE_LIMIT_MS = 250;
  const MAX_ATTEMPTS = 4;

  async function sendReaction(emoji: string, method: "POST" | "DELETE") {
    let lastRes: Response | null = null;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      lastRes = await fetch("/api/reactions", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      if (lastRes.status !== 429) break;
      await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
    }
    return lastRes!;
  }

  async function toggle(emoji: string) {
    // Lock the whole widget while a request is in flight so rapid clicks can't
    // trip the server rate limit and get rejected. The lock also stays on for
    // the full rate-limit window so the buttons read as disabled until the
    // server would accept another reaction.
    if (locked) return;
    setLocked(true);
    const lockStart = Date.now();

    const has = reactedRef.current.has(emoji);
    const nextReacted = new Set(reactedRef.current);
    if (has) nextReacted.delete(emoji);
    else nextReacted.add(emoji);

    // Optimistic update for snappy UI; server response reconciles to truth.
    updateReacted(nextReacted);
    setCounts((c) => ({ ...c, [emoji]: (c[emoji] || 0) + (has ? -1 : 1) }));

    try {
      const res = await sendReaction(emoji, has ? "DELETE" : "POST");
      const data = await res.json();
      if (res.ok && data.counts) {
        applyCounts(data);
      } else {
        throw new Error();
      }
    } catch {
      // Revert optimistic change back to the last known server-derived state.
      const revert = new Set(reactedRef.current);
      if (has) revert.add(emoji);
      else revert.delete(emoji);
      updateReacted(revert);
      setCounts((c) => ({ ...c, [emoji]: (c[emoji] || 0) + (has ? 1 : -1) }));
    } finally {
      const remaining = RATE_LIMIT_MS - (Date.now() - lockStart);
      if (remaining > 0) {
        setTimeout(() => setLocked(false), remaining);
      } else {
        setLocked(false);
      }
    }
  }

  const buttonBase = `flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md${enableGradientBorders ? " gradient-border-card" : " border border-gray-300 dark:border-gray-600"}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {emojis.map((emoji) => {
          const active = reacted.has(emoji);
          const count = counts[emoji] || 0;
          return (
            <button
              key={emoji}
              type="button"
              onClick={() => toggle(emoji)}
              disabled={locked}
              aria-pressed={active}
              className={`${buttonBase} ${
                active
                  ? "bg-blue-600/20 text-blue-600 dark:text-blue-300"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
              } ${locked ? "opacity-50 grayscale pointer-events-none" : ""}`}
            >
              <span className="text-xl leading-none">{emoji}</span>
              <span className="font-medium tabular-nums">{loading ? "·" : count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
