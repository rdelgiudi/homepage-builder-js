"use client";

import { useEffect } from "react";

const FALLBACK_GRADIENT = ["#60a5fa", "#a78bfa", "#f472b6"];
const ROTATION_MS = 3000;
const FRAME_INTERVAL_MS = 50;
const MARKER = "data-anim-favicon";

interface Props {
  gradient?: string[];
}

export default function FaviconAnimation({ gradient }: Props) {
  useEffect(() => {
    const colors =
      gradient && gradient.length > 0 ? gradient : FALLBACK_GRADIENT;

    const canvas = document.createElement("canvas");
    const SIZE = 32;
    const CX = SIZE / 2;
    const CY = SIZE / 2;
    const R = 12;
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let running = true;
    let lastPaint = 0;
    const start = performance.now();
    let link: HTMLLinkElement | null = null;

    function ensureLink(): HTMLLinkElement {
      let el = document.querySelector<HTMLLinkElement>(
        `link[rel="icon"][${MARKER}]`
      );
      if (!el) {
        el = document.createElement("link");
        el.rel = "icon";
        el.setAttribute(MARKER, "1");
        document.head.appendChild(el);
      }
      return el;
    }

    function pruneStaleLinks() {
      document
        .querySelectorAll<HTMLLinkElement>(
          `link[rel="icon"]:not([${MARKER}])`
        )
        .forEach((el) => el.remove());
    }

    function render(now: number) {
      if (!running) return;
      raf = requestAnimationFrame(render);
      if (now - lastPaint < FRAME_INTERVAL_MS) return;
      lastPaint = now;
      try {
        if (!link || !link.isConnected) link = ensureLink();
        pruneStaleLinks();
        const c = ctx!;
        c.clearRect(0, 0, SIZE, SIZE);
        const angle = ((now - start) / ROTATION_MS) * Math.PI * 2;
        const grad = c.createConicGradient(angle, CX, CY);
        colors.forEach((color, i) =>
          grad.addColorStop(i / colors.length, color)
        );
        grad.addColorStop(1, colors[0]);
        c.strokeStyle = grad;
        c.lineWidth = 2.5;
        c.lineCap = "round";
        c.lineJoin = "round";
        c.beginPath();
        c.arc(CX, CY, R, 0, Math.PI * 2);
        c.stroke();
        link!.href = canvas.toDataURL("image/png");
      } catch {
        // Never let a thrown error kill the animation loop.
      }
    }

    raf = requestAnimationFrame(render);

    function onVisibility() {
      if (document.visibilityState === "visible" && running) {
        cancelAnimationFrame(raf);
        lastPaint = 0;
        raf = requestAnimationFrame(render);
      }
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      if (link && link.isConnected) link.remove();
    };
  }, [gradient]);

  return null;
}
