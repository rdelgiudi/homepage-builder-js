"use client";

import { useEffect, useState } from "react";
import type { BannerConfig } from "@/lib/schema/config";

/** Scrolled past this, a title that shares its row with the tabs makes room for them. */
const AWAY_AFTER = 48;
const BACK_BEFORE = 12;
/** Movement (px) before a change of direction counts, so a trembling finger doesn't toggle it. */
const DIRECTION_STEP = 8;

/**
 * The sticky part of the banner:
 * - `setElement` goes on it. Its height is published on <main> for whatever has to stay clear of
 *   it: `--banner-h` (one-page section anchors) and `--banner-shown`, 0 while it is hidden (the
 *   profile column).
 * - `hidden` (`hide`): scrolled down, so the banner is out of sight until scrolling up.
 * - `away` (`tabs`): scrolled, so a title in the same row as the tabs is hidden.
 *
 * In one row with the tabs on their own line below (one page on phones), the part to keep is
 * marked `data-banner-keep`; with `scroll: "tabs"` the rest slides out above the window.
 */
export function useBannerScroll(scroll: BannerConfig["scroll"]) {
  const [el, setElement] = useState<HTMLElement | null>(null);
  const [away, setAway] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const main = el?.closest("main");
    if (!el || !main) return;
    const measure = () => {
      const keep = el.querySelector<HTMLElement>("[data-banner-keep]");
      const top = scroll === "tabs" && keep?.offsetHeight ? keep.offsetHeight - el.offsetHeight : 0;
      el.style.top = top ? `${top}px` : "";
      // Not sticky at this width (or not shown at all): nothing to stay clear of.
      const height = el.offsetHeight && getComputedStyle(el).position === "sticky" ? el.offsetHeight + top : 0;
      main.style.setProperty("--banner-h", `${height}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      el.style.top = "";
      main.style.removeProperty("--banner-h");
    };
  }, [el, scroll]);

  useEffect(() => {
    setAway(false);
    setHidden(false);
    if (!el || scroll === "all") return;
    let last = window.scrollY;
    const onScroll = () => {
      // Clamped: overscroll bounce must not read as scrolling up or down.
      const end = document.documentElement.scrollHeight - window.innerHeight;
      const y = Math.max(0, Math.min(window.scrollY, end));
      if (scroll === "tabs") {
        setAway((was) => (was ? y > BACK_BEFORE : y > AWAY_AFTER));
        return;
      }
      if (y <= el.offsetHeight) setHidden(false);
      else if (Math.abs(y - last) < DIRECTION_STEP) return;
      else setHidden(y > last);
      last = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [el, scroll]);

  useEffect(() => {
    const main = el?.closest("main");
    if (!main) return;
    main.style.setProperty("--banner-shown", hidden ? "0px" : "var(--banner-h)");
    return () => {
      main.style.removeProperty("--banner-shown");
    };
  }, [el, hidden]);

  return { setElement, away, hidden };
}
