"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWebSocket } from "@/hooks/useWebSocket";

/** Message the admin panel posts to its preview iframe after saving the draft. */
export const PREVIEW_REFRESH = "homepage:preview-refresh";
/** Message `{ type: PREVIEW_TAB, tab }` — the admin panel asks its preview to show a tab. */
export const PREVIEW_TAB = "homepage:preview-tab";

/**
 * Re-renders the page with fresh config, without a reload:
 * - live site: when the server announces that homepage.json changed (`{ type: "config" }`)
 * - admin preview (`preview`): when the admin panel says the draft was saved, or asks for a tab
 */
export default function ConfigSync({ preview }: { preview: boolean }) {
  const router = useRouter();

  useWebSocket({
    enabled: !preview,
    onMessage: (data) => {
      if ((data as { type?: string })?.type === "config") router.refresh();
    },
  });

  useEffect(() => {
    if (!preview) return;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data === PREVIEW_REFRESH) router.refresh();
      else if (e.data?.type === PREVIEW_TAB && typeof e.data.tab === "string") {
        router.replace(`${window.location.pathname}?tab=${encodeURIComponent(e.data.tab)}`, { scroll: false });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [preview, router]);

  return null;
}
