type BroadcastFn = (msg: unknown) => void;

// The WebSocket server (websocket-server.js) runs in the same Node process as
// the Next.js API routes and assigns `globalThis.__wssBroadcast` to its
// broadcast function. We use it to push real-time events (e.g. emoji
// reactions) to every connected browser client.
export function broadcastReaction(emoji: string): void {
  const fn = (globalThis as Record<string, unknown>).__wssBroadcast as BroadcastFn | undefined;
  if (typeof fn === "function") {
    fn({ type: "reaction", emoji, at: Date.now() });
  }
}
