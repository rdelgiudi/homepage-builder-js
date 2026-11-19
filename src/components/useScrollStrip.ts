"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

/**
 * A row of buttons that may be wider than its box (the one-page jump bar, the tab bar in a
 * narrow layout): it scrolls sideways, keeps the current button (`aria-current`) in view by
 * scrolling the row itself — never the page — and fades the edge(s) that have more buttons
 * beyond (`.scroll-strip` in globals.css, driven by --fade-l / --fade-r).
 *
 * Put `ref` and `style` on the row and give it the `scroll-strip` class, `min-w-0` when it is
 * a flex item (a flex item won't shrink below its content otherwise and just overflows its
 * parent), and `is-centered` if it should be centred while it fits. (Not Tailwind's
 * `justify-[safe_center]`: Tailwind 3 has no arbitrary values for justify-content and
 * silently generates nothing.)
 */
export function useScrollStrip<T extends HTMLElement>(active: unknown, items: number) {
  const ref = useRef<T>(null);
  const [more, setMore] = useState({ left: false, right: false });

  useEffect(() => {
    const el = ref.current;
    const current = el?.querySelector<HTMLElement>('[aria-current]:not([aria-current="false"])');
    if (!el || !current || el.scrollWidth <= el.clientWidth) return;
    // From bounding boxes, so it doesn't matter whether the row is the buttons' offsetParent.
    const box = el.getBoundingClientRect();
    const cur = current.getBoundingClientRect();
    const left = el.scrollLeft + (cur.left - box.left) - (el.clientWidth - cur.width) / 2;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: Math.max(0, left), behavior: reduce ? "auto" : "smooth" });
  }, [active]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setMore({ left: el.scrollLeft > 2, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 });
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [items]);

  const style = { "--fade-l": more.left ? "28px" : "0px", "--fade-r": more.right ? "28px" : "0px" } as CSSProperties;
  return { ref, style };
}
