"use client";

import { useEffect, useRef } from "react";

interface UseWebSocketOptions {
  onMessage: (data: unknown) => void;
  enabled?: boolean;
  // When false, every message is delivered to this listener immediately
  // instead of being coalesced per type within a rAF tick. Needed for event
  // streams (e.g. reaction flyers) where every message matters.
  coalesce?: boolean;
}

interface ListenerEntry {
  fn: (data: unknown) => void;
  coalesce: boolean;
}

let sharedWs: WebSocket | null = null;
let subscriberCount = 0;
const listeners = new Set<ListenerEntry>();
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

let pendingByType = new Map<string, unknown>();
let flushScheduled = false;

function scheduleFlush() {
  if (flushScheduled) return;
  flushScheduled = true;
  const flush = () => {
    flushScheduled = false;
    if (pendingByType.size === 0) return;
    const batch = pendingByType;
    pendingByType = new Map();
    for (const entry of listeners) {
      if (!entry.coalesce) continue;
      for (const msg of batch.values()) {
        try {
          entry.fn(msg);
        } catch (e) {
          console.error("WebSocket listener error:", e);
        }
      }
    }
  };
  if (typeof requestAnimationFrame !== "undefined") {
    requestAnimationFrame(flush);
  } else {
    setTimeout(flush, 16);
  }
}

function createConnection() {
  if (typeof window === "undefined") return;

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const url = `${protocol}//${window.location.host}/ws`;

  const ws = new WebSocket(url);

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      const type = (msg && typeof msg === "object" && "type" in msg) ? String(msg.type) : "_";
      // Non-coalescing listeners get every message right away.
      for (const entry of listeners) {
        if (!entry.coalesce) {
          try {
            entry.fn(msg);
          } catch (e) {
            console.error("WebSocket listener error:", e);
          }
        }
      }
      // Coalescing listeners receive one message per type per frame.
      const hasCoalescing = [...listeners].some((e) => e.coalesce);
      if (hasCoalescing) {
        pendingByType.set(type, msg);
        scheduleFlush();
      }
    } catch {}
  };

  ws.onclose = () => {
    if (sharedWs === ws) {
      sharedWs = null;
      if (subscriberCount > 0) {
        reconnectTimer = setTimeout(createConnection, 3000);
      }
    }
  };

  ws.onerror = () => {
    ws.close();
  };

  sharedWs = ws;
}

function teardownConnection() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  sharedWs?.close();
  sharedWs = null;
}

export function useWebSocket({ onMessage, enabled = true, coalesce = true }: UseWebSocketOptions) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const coalesceRef = useRef(coalesce);
  coalesceRef.current = coalesce;

  useEffect(() => {
    if (!enabled) return;

    const listener: ListenerEntry = { fn: (data: unknown) => onMessageRef.current(data), coalesce: coalesceRef.current };
    listeners.add(listener);

    if (subscriberCount === 0) {
      createConnection();
    }
    subscriberCount++;

    return () => {
      listeners.delete(listener);
      subscriberCount--;

      if (subscriberCount === 0) {
        teardownConnection();
      }
    };
  }, [enabled]);
}

export function sendWebSocket(data: unknown): boolean {
  if (sharedWs && sharedWs.readyState === WebSocket.OPEN) {
    sharedWs.send(JSON.stringify(data));
    return true;
  }
  return false;
}
