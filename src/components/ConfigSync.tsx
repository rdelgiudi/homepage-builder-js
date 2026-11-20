"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useWebSocket } from "@/hooks/useWebSocket";
import { linkTarget, pagePath } from "@/lib/pages";

/** Message the admin panel posts to its preview iframe after saving the draft. */
export const PREVIEW_REFRESH = "homepage:preview-refresh";
/**
 * Message `{ type: PREVIEW_TAB, page?, tab }` — the admin panel asks its preview to show a
 * page (slug, "" = the homepage; unset = stay on this page) and a tab of it ("" = its first).
 */
export const PREVIEW_TAB = "homepage:preview-tab";
/**
 * Message `{ type: PREVIEW_SHOWN, page, tab }` the preview posts to the admin panel when it
 * changes what it shows by itself (a tab switch, a one-page jump or scroll, a link to another page).
 */
export const PREVIEW_SHOWN = "homepage:preview-shown";

/**
 * Message `{ type: PREVIEW_READY }` the preview posts when it starts listening. Anything the panel
 * sent before (while the iframe was still loading) was lost, so the panel sends its page and tab again.
 */
export const PREVIEW_READY = "homepage:preview-ready";

const PREVIEW_ROOT = "/admin/preview";

/**
 * Set once the preview has announced itself. Per document load, not per mount: ConfigSync
 * remounts on every page change inside the preview, and announcing again then made the panel
 * send its own page back, undoing a link the visitor had just followed.
 */
let announcedReady = false;

/** The page slug of an /admin/preview path ("" = the homepage). */
const previewPage = (pathname: string) => pathname.slice(PREVIEW_ROOT.length).replace(/^\/|\/$/g, "");
const inPreviewFrame = () => typeof window !== "undefined" && window.parent !== window && window.location.pathname.startsWith(PREVIEW_ROOT);

/**
 * Tells the admin panel which page and tab (slugs) the preview now shows, so its builder
 * follows. Does nothing outside the panel's preview iframe (the live site has no parent to tell).
 */
export function reportPreviewTab(tab: string) {
  if (!inPreviewFrame()) return;
  window.parent.postMessage({ type: PREVIEW_SHOWN, page: previewPage(window.location.pathname), tab }, window.location.origin);
}

/**
 * Re-renders the page with fresh config, without a reload:
 * - live site: when the server announces that homepage.json changed (`{ type: "config" }`)
 * - admin preview (`preview`): when the admin panel says the draft was saved, or asks for a page / tab
 */
export default function ConfigSync({ preview }: { preview: boolean }) {
  const router = useRouter();
  const pathname = usePathname();

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
        const path = typeof e.data.page === "string" ? `${PREVIEW_ROOT}${e.data.page ? `/${e.data.page}` : ""}` : window.location.pathname;
        router.replace(`${path}${e.data.tab ? `?tab=${encodeURIComponent(e.data.tab)}` : ""}`, { scroll: path !== window.location.pathname });
      }
    };
    window.addEventListener("message", onMessage);
    if (inPreviewFrame() && !announcedReady) {
      announcedReady = true;
      window.parent.postMessage({ type: PREVIEW_READY }, window.location.origin);
    }
    return () => window.removeEventListener("message", onMessage);
  }, [preview, router]);

  // Preview: a link to another page of the site stays in the preview (the live page would show
  // the published version, and in the two-container setup it isn't the admin container at all).
  useEffect(() => {
    if (!preview) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self")) return;
      const slug = linkTarget(a.getAttribute("href") ?? "", previewPage(window.location.pathname), [window.location.host]);
      if (slug === null) return;
      e.preventDefault();
      const url = new URL(a.href);
      router.push(`${PREVIEW_ROOT}${slug ? pagePath(slug) : ""}${url.search}${url.hash}`);
    };
    // Capture phase: runs before next/link's own handler, which then sees defaultPrevented.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [preview, router]);

  // Preview: report page changes (a followed link) so the builder opens the same page. And
  // refresh once after each page change: a draft saved while the navigation was under way
  // asked for a refresh of the old page, so the new one could show data from before the save.
  const firstPath = useRef(true);
  useEffect(() => {
    if (!preview) return;
    reportPreviewTab(new URLSearchParams(window.location.search).get("tab") ?? "");
    if (firstPath.current) firstPath.current = false;
    else router.refresh();
  }, [preview, pathname, router]);

  return null;
}
