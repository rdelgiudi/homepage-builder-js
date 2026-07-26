"use client";

import { useState, useCallback } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";

interface Flyer {
  id: number;
  emoji: string;
  left: number;
  drift: number;
  duration: number;
  size: number;
  rotate: number;
}

let nextId = 0;
const MAX_FLYERS = 40;

export default function ReactionFlyer() {
  const [flyers, setFlyers] = useState<Flyer[]>([]);

  const onMessage = useCallback((data: unknown) => {
    const msg = data as { type?: string; emoji?: string; action?: string };
    if (msg?.type !== "reaction" || typeof msg.emoji !== "string") return;
    // Only fly on a new reaction — un-reacting ("remove") just updates counts.
    if (msg.action === "remove") return;

    const flyer: Flyer = {
      id: nextId++,
      emoji: msg.emoji,
      left: 4 + Math.random() * 92,
      drift: (Math.random() - 0.5) * 180,
      duration: 4 + Math.random() * 3,
      size: 1.5 + Math.random() * 1.8,
      rotate: (Math.random() - 0.5) * 40,
    };

    setFlyers((prev) => {
      const next = [...prev, flyer];
      return next.length > MAX_FLYERS ? next.slice(next.length - MAX_FLYERS) : next;
    });
  }, []);

  const remove = useCallback((id: number) => {
    setFlyers((prev) => prev.filter((f) => f.id !== id));
  }, []);

  // Opt out of per-frame coalescing so every reaction broadcasts a flyer.
  useWebSocket({ onMessage, coalesce: false });

  return (
    <div className="fixed inset-0 z-[-1] pointer-events-none overflow-hidden" aria-hidden="true">
      {flyers.map((f) => (
        <span
          key={f.id}
          className="reaction-fly absolute will-change-transform"
          style={
            {
              left: `${f.left}%`,
              bottom: "-2.5rem",
              fontSize: `${f.size}rem`,
              "--drift": `${f.drift}px`,
              "--rotate": `${f.rotate}deg`,
              animationDuration: `${f.duration}s`,
            } as React.CSSProperties
          }
          onAnimationEnd={() => remove(f.id)}
        >
          {f.emoji}
        </span>
      ))}
    </div>
  );
}
