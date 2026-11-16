"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PREVIEW_REFRESH, PREVIEW_TAB } from "@/components/ConfigSync";
import { useAdmin } from "./store";

/** The real site, rendered from the draft, in an iframe that follows every saved edit. */
export default function PreviewPane({ tabSlug }: { tabSlug: string }) {
  const { savedTick, hasDraft } = useAdmin();
  const frame = useRef<HTMLIFrameElement>(null);
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  // The src is fixed at mount; later tab changes are sent as messages so the page never reloads.
  const [src] = useState(() => `/?preview=draft${tabSlug ? `&tab=${encodeURIComponent(tabSlug)}` : ""}`);

  const post = useCallback((message: unknown) => {
    frame.current?.contentWindow?.postMessage(message, window.location.origin);
  }, []);

  useEffect(() => {
    if (savedTick > 0) post(PREVIEW_REFRESH);
  }, [savedTick, post]);

  useEffect(() => {
    if (tabSlug) post({ type: PREVIEW_TAB, tab: tabSlug });
  }, [tabSlug, post]);

  return (
    <section className="adm-preview" aria-label="Preview">
      <div className="adm-preview-bar">
        <span className="adm-muted">{hasDraft ? "Preview of your draft" : "Preview — same as the live site"}</span>
        <div className="adm-seg" role="group" aria-label="Preview size">
          <button type="button" aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")}>
            Desktop
          </button>
          <button type="button" aria-pressed={device === "phone"} onClick={() => setDevice("phone")}>
            Phone
          </button>
        </div>
      </div>
      <div className="adm-preview-stage">
        <iframe ref={frame} src={src} title="Site preview" className={device === "phone" ? "is-phone" : ""} />
      </div>
    </section>
  );
}
