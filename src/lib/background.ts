/**
 * Turns a `background.base` config into the CSS for the background layer.
 * Pure (no React, no DOM) so it can run on the server and the client.
 */
import type { CSSProperties } from "react";
import type { BackgroundBase } from "@/lib/schema/config";

/**
 * Only our own uploads and plain http(s) URLs may end up inside `url(...)`; anything
 * with quotes, brackets or whitespace is dropped so a value can't break out of it.
 */
const SAFE_URL = /^(https?:\/\/|\/api\/uploads\/)[^\s"'()\\<>]+$/;

export function safeUrl(value: string | undefined): string | null {
  return value && SAFE_URL.test(value) ? value : null;
}

const cssUrl = (value: string | undefined) => {
  const url = safeUrl(value);
  return url ? `url("${url}")` : null;
};

function gradient(stops: string[] | undefined, angle: number): string | null {
  if (!stops?.length) return null;
  // A single stop is a flat colour; CSS needs two.
  const list = stops.length === 1 ? [stops[0], stops[0]] : stops;
  return `linear-gradient(${angle}deg, ${list.join(", ")})`;
}

const NOISE = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.35 0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>'
)}")`;

function pattern(kind: BackgroundBase["pattern"], ink: string, size: number): { image: string; size: string } {
  switch (kind) {
    case "grid":
      return { image: `linear-gradient(${ink} 1px, transparent 1px), linear-gradient(90deg, ${ink} 1px, transparent 1px)`, size: `${size}px ${size}px` };
    case "diagonal":
      return { image: `repeating-linear-gradient(45deg, ${ink} 0, ${ink} 1px, transparent 1px, transparent ${size / 2}px)`, size: "auto" };
    case "noise":
      return { image: NOISE, size: `${size * 4}px ${size * 4}px` };
    default:
      return { image: `radial-gradient(circle, ${ink} 1.3px, transparent 1.6px)`, size: `${size}px ${size}px` };
  }
}

export interface BackgroundLayerSpec {
  /** Nothing to draw beyond the page colour. */
  empty: boolean;
  /** CSS custom properties read by `.bg-layer` in globals.css (light and dark variants). */
  vars: CSSProperties;
  /** Extra classes for `.bg-layer`. */
  className: string;
  video: { src: string; poster: string | null } | null;
  fixed: boolean;
}

export function backgroundLayer(base: BackgroundBase): BackgroundLayerSpec {
  const spec: BackgroundLayerSpec = { empty: true, vars: {}, className: "", video: null, fixed: true };
  const set = (light: string | null, dark: string | null, extra: Record<string, string> = {}) => {
    if (!light && !dark) return;
    spec.empty = false;
    spec.vars = { "--bg-image-light": light ?? dark ?? "none", "--bg-image-dark": dark ?? light ?? "none", ...extra } as CSSProperties;
  };

  switch (base.type) {
    case "gradient":
      set(gradient(base.gradientLight, base.angle), gradient(base.gradientDark, base.angle));
      if (base.animated) spec.className = "bg-layer-drift";
      break;
    case "image": {
      const tile = base.fit === "tile";
      set(cssUrl(base.image), cssUrl(base.imageDark), {
        "--bg-size": tile ? "auto" : base.fit,
        "--bg-repeat": tile ? "repeat" : "no-repeat",
        "--bg-position": base.position,
      });
      spec.fixed = base.fixed;
      break;
    }
    case "pattern": {
      const light = pattern(base.pattern, base.patternColor || "rgb(17 24 39 / 0.14)", base.patternSize);
      const dark = pattern(base.pattern, base.patternColor || "rgb(255 255 255 / 0.11)", base.patternSize);
      set(light.image, dark.image, { "--bg-size": light.size, "--bg-repeat": "repeat", "--bg-position": "0 0" });
      spec.fixed = base.fixed;
      break;
    }
    case "video": {
      const src = safeUrl(base.video);
      if (src) {
        spec.empty = false;
        spec.video = { src, poster: safeUrl(base.poster) };
      } else {
        // No video chosen yet: fall back to the still image, if there is one.
        set(cssUrl(base.poster), null, { "--bg-size": "cover", "--bg-repeat": "no-repeat", "--bg-position": "center" });
      }
      break;
    }
  }
  return spec;
}
