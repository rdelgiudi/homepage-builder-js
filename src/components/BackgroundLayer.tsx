"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
import type { BackgroundBase } from "@/lib/schema/config";
import { backgroundLayer } from "@/lib/background";

interface BackgroundLayerProps {
  base: BackgroundBase;
  overlay: { dim: number; blur: number };
  /** Tabs that replace the background while they are open: URL slug → base. */
  tabOverrides: { slug: string; base: BackgroundBase }[];
  /** Slug of the tab shown when the URL names none. */
  firstTabSlug: string;
}

function Layer({ base, blur, fading }: { base: BackgroundBase; blur: number; fading: boolean }) {
  const spec = backgroundLayer(base);
  const video = useRef<HTMLVideoElement>(null);

  // Visitors who ask for reduced motion get the still image instead of a playing video.
  useEffect(() => {
    if (video.current && window.matchMedia("(prefers-reduced-motion: reduce)").matches) video.current.pause();
  }, [spec.video?.src]);

  if (spec.empty) return null;
  const style: CSSProperties = {
    ...spec.vars,
    // Blurring the layer itself (not a backdrop filter) is cheap; the slight scale hides the soft edges.
    ...(blur > 0 ? { filter: `blur(${blur}px)`, transform: "scale(1.06)" } : null),
  };
  return (
    <div className={`bg-layer ${spec.fixed ? "fixed" : "absolute"} inset-0 ${spec.className}${fading ? " bg-layer-in" : ""}`} style={style}>
      {spec.video && (
        <video ref={video} className="w-full h-full object-cover" src={spec.video.src} poster={spec.video.poster ?? undefined} autoPlay muted loop playsInline preload="metadata" aria-hidden />
      )}
    </div>
  );
}

/**
 * Everything between the page colour and the particle canvas: the gradient / image /
 * video / pattern, then the "fade toward the page colour" overlay. Sits behind the
 * content (`-z-20`, inside <main>'s stacking context) and never takes pointer events.
 *
 * A tab with its own background replaces the site's while it is open; the new layer
 * fades in over the old one (CSS can't transition between two background images).
 */
export default function BackgroundLayer({ base, overlay, tabOverrides, firstTabSlug }: BackgroundLayerProps) {
  const slug = useSearchParams().get("tab") ?? firstTabSlug;
  const active = tabOverrides.find((t) => t.slug === slug)?.base ?? base;
  const key = JSON.stringify(active);

  // Keep the outgoing background underneath until the incoming one has faded in.
  const [previous, setPrevious] = useState<{ key: string; base: BackgroundBase } | null>(null);
  const last = useRef({ key, base: active });
  useEffect(() => {
    if (last.current.key === key) return;
    setPrevious(last.current);
    last.current = { key, base: active };
    const timer = setTimeout(() => setPrevious(null), 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const dimmed = overlay.dim > 0 && active.type !== "solid";
  return (
    <div className="absolute inset-0 -z-20 overflow-hidden pointer-events-none" aria-hidden>
      {previous && <Layer key={previous.key} base={previous.base} blur={overlay.blur} fading={false} />}
      <Layer key={key} base={active} blur={overlay.blur} fading={!!previous} />
      {dimmed && <div className="fixed inset-0 bg-page" style={{ opacity: overlay.dim / 100 }} />}
    </div>
  );
}
