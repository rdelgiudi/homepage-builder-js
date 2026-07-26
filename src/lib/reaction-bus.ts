type BroadcastFn = (msg: unknown) => void;

export interface ReactionCount {
  emoji: string;
  count: number;
}

// The WebSocket server (websocket-server.js) runs in the same Node process as
// the Next.js API routes and assigns `globalThis.__wssBroadcast` to its
// broadcast function. We use it to push real-time events (e.g. emoji
// reactions) to every connected browser client, including the updated counts
// so every viewer's counter stays in sync. `action` is "add" (a new reaction)
// or "remove" (an un-reaction) — only "add" should spawn the background flyer.
export function broadcastReaction(
  emoji: string,
  counts: ReactionCount[],
  action: "add" | "remove"
): void {
  const fn = (globalThis as Record<string, unknown>).__wssBroadcast as BroadcastFn | undefined;
  if (typeof fn === "function") {
    fn({ type: "reaction", emoji, counts, action, at: Date.now() });
  }
}
