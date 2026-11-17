"use client";

import { useEffect, useRef } from "react";

export type AmbientMode = "snow" | "fireflies" | "constellation" | "aurora";

interface AmbientEffectsProps {
  mode: AmbientMode;
  /** Multiplies the number of particles (1 = normal). */
  density: number;
  /** Multiplies movement speed (1 = normal). */
  speed: number;
  /** Overrides the effect's own colour(s). */
  color?: string;
  /** Aurora's ribbons use these when no `color` is set (the title gradient). */
  palette: string[];
}

type Rgb = [number, number, number];

/** Resolves any CSS colour to r,g,b by letting the browser parse it. */
function toRgb(color: string, fallback: Rgb): Rgb {
  const probe = document.createElement("canvas").getContext("2d");
  if (!probe) return fallback;
  probe.fillStyle = "#000";
  probe.fillStyle = color;
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(probe.fillStyle));
  if (m) return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
  const n = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(String(probe.fillStyle));
  return n ? [Number(n[1]), Number(n[2]), Number(n[3])] : fallback;
}

interface Dot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  phase: number;
  rate: number;
  rgb: Rgb;
}

const AURORA_DEFAULTS = ["#60a5fa", "#a78bfa", "#f472b6", "#34d399"];
/** Aurora is drawn at a fraction of the screen resolution and stretched: cheap, and soft for free. */
const AURORA_SCALE = 0.2;
const LINK_DISTANCE = 130;

/**
 * Canvas effects that only need "a set of drifting dots": snow, fireflies, a
 * constellation (dots joined by lines when close) and aurora (large soft blobs).
 * Same layering and housekeeping as ParticleBackground: transparent canvas behind the
 * content, fewer particles on phones, paused while the tab is hidden, recoloured when
 * the theme changes. With "reduce motion" on, a single still frame is drawn.
 */
export default function AmbientEffects({ mode, density, speed, color, palette }: AmbientEffectsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paletteKey = palette.join(",");

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scale = mode === "aurora" ? AURORA_SCALE : 1;
    let dots: Dot[] = [];
    let animId = 0;
    let last = 0;

    const isDark = () => document.documentElement.classList.contains("dark");

    function colors(): Rgb[] {
      if (color) return [toRgb(color, [148, 163, 184])];
      const dark = isDark();
      switch (mode) {
        case "snow":
          return [dark ? [226, 232, 240] : [100, 116, 139]];
        case "fireflies":
          return [dark ? [250, 204, 21] : [202, 138, 4]];
        case "constellation":
          return [dark ? [148, 163, 184] : [75, 85, 99]];
        default:
          return (palette.length ? palette : AURORA_DEFAULTS).map((c) => toRgb(c, [96, 165, 250]));
      }
    }

    function count() {
      const mobile = window.innerWidth < 640;
      const base = Math.min(Math.floor(window.innerWidth * (mobile ? 0.025 : 0.04)), mobile ? 30 : 60);
      const perMode = { snow: 1.6, fireflies: 0.5, constellation: 1, aurora: 0.1 }[mode];
      return Math.max(mode === "aurora" ? 3 : 4, Math.round(base * perMode * density));
    }

    function init() {
      const w = (canvas!.width = Math.max(1, Math.round(window.innerWidth * scale)));
      const h = (canvas!.height = Math.max(1, Math.round(window.innerHeight * scale)));
      const palette = colors();
      dots = Array.from({ length: count() }, (_, i) => {
        const dot: Dot = {
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          size: Math.random() * 2 + 1,
          phase: Math.random() * Math.PI * 2,
          rate: Math.random() * 0.0015 + 0.0006,
          rgb: palette[i % palette.length],
        };
        if (mode === "snow") {
          dot.vy = Math.random() * 0.9 + 0.35;
          dot.vx = (Math.random() - 0.5) * 0.3;
          dot.size = Math.random() * 2.4 + 0.8;
        } else if (mode === "fireflies") {
          dot.size = Math.random() * 1.6 + 1.2;
        } else if (mode === "aurora") {
          dot.size = (Math.random() * 0.35 + 0.35) * Math.max(w, h);
          dot.vx = (Math.random() - 0.5) * 0.12;
          dot.vy = (Math.random() - 0.5) * 0.06;
          dot.y = Math.random() * h * 0.7;
        }
        return dot;
      });
    }

    function step(dt: number, now: number) {
      const w = canvas!.width;
      const h = canvas!.height;
      const k = dt * speed;
      for (const d of dots) {
        if (mode === "snow") {
          d.x += (d.vx + Math.sin(now * d.rate + d.phase) * 0.35) * k;
          d.y += d.vy * k;
          if (d.y > h + 4) {
            d.y = -4;
            d.x = Math.random() * w;
          }
        } else if (mode === "fireflies") {
          // Wander: nudge the heading a little every frame, keep the pace gentle.
          d.vx += (Math.random() - 0.5) * 0.03;
          d.vy += (Math.random() - 0.5) * 0.03;
          const pace = Math.hypot(d.vx, d.vy);
          if (pace > 0.5) {
            d.vx *= 0.5 / pace;
            d.vy *= 0.5 / pace;
          }
          d.x += d.vx * k;
          d.y += d.vy * k;
        } else {
          d.x += d.vx * k;
          d.y += d.vy * k;
        }
        const pad = mode === "aurora" ? d.size * 0.5 : 6;
        if (d.x < -pad) d.x = w + pad;
        if (d.x > w + pad) d.x = -pad;
        if (mode !== "snow") {
          if (d.y < -pad) d.y = h + pad;
          if (d.y > h + pad) d.y = -pad;
        }
      }
    }

    function draw(now: number) {
      const w = canvas!.width;
      const h = canvas!.height;
      const dark = isDark();
      ctx!.clearRect(0, 0, w, h);

      if (mode === "aurora") {
        for (const d of dots) {
          const pulse = 0.75 + 0.25 * Math.sin(now * d.rate * 0.6 + d.phase);
          const g = ctx!.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.size);
          g.addColorStop(0, `rgba(${d.rgb.join(",")}, ${(dark ? 0.3 : 0.22) * pulse})`);
          g.addColorStop(1, `rgba(${d.rgb.join(",")}, 0)`);
          ctx!.fillStyle = g;
          ctx!.fillRect(0, 0, w, h);
        }
        return;
      }

      if (mode === "constellation") {
        ctx!.lineWidth = 1;
        for (let i = 0; i < dots.length; i++) {
          for (let j = i + 1; j < dots.length; j++) {
            const a = dots[i];
            const b = dots[j];
            const dist = Math.hypot(a.x - b.x, a.y - b.y);
            if (dist > LINK_DISTANCE) continue;
            ctx!.strokeStyle = `rgba(${a.rgb.join(",")}, ${(1 - dist / LINK_DISTANCE) * (dark ? 0.35 : 0.3)})`;
            ctx!.beginPath();
            ctx!.moveTo(a.x, a.y);
            ctx!.lineTo(b.x, b.y);
            ctx!.stroke();
          }
        }
      }

      for (const d of dots) {
        const twinkle = 0.5 + 0.5 * Math.sin(now * d.rate * (mode === "fireflies" ? 2.2 : 1) + d.phase);
        if (mode === "fireflies") {
          const glow = d.size * 7;
          const g = ctx!.createRadialGradient(d.x, d.y, 0, d.x, d.y, glow);
          g.addColorStop(0, `rgba(${d.rgb.join(",")}, ${0.75 * twinkle})`);
          g.addColorStop(0.25, `rgba(${d.rgb.join(",")}, ${0.25 * twinkle})`);
          g.addColorStop(1, `rgba(${d.rgb.join(",")}, 0)`);
          ctx!.fillStyle = g;
          ctx!.fillRect(d.x - glow, d.y - glow, glow * 2, glow * 2);
        } else {
          const alpha = mode === "snow" ? (dark ? 0.75 : 0.55) : (dark ? 0.45 : 0.5) + 0.25 * twinkle;
          ctx!.fillStyle = `rgba(${d.rgb.join(",")}, ${alpha})`;
          ctx!.beginPath();
          ctx!.arc(d.x, d.y, d.size, 0, Math.PI * 2);
          ctx!.fill();
        }
      }
    }

    function frame(now: number) {
      // Normalise to 60fps steps so speed is the same on any refresh rate.
      const dt = last ? Math.min((now - last) / (1000 / 60), 3) : 1;
      last = now;
      step(dt, now);
      draw(now);
      animId = requestAnimationFrame(frame);
    }

    function start() {
      last = 0;
      if (still) draw(performance.now());
      else animId = requestAnimationFrame(frame);
    }

    const onResize = () => {
      init();
      if (still) draw(performance.now());
    };
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(animId);
        animId = 0;
      } else if (!animId && !still) {
        start();
      }
    };
    // Theme switch: keep positions, swap colours.
    const observer = new MutationObserver(() => {
      const palette = colors();
      dots.forEach((d, i) => (d.rgb = palette[i % palette.length]));
      if (still) draw(performance.now());
    });

    init();
    start();
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, density, speed, color, paletteKey]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed pointer-events-none -z-10"
      style={{ top: 0, right: 0, bottom: 0, left: 0, width: "100vw", height: "100vh", transform: "translate3d(0,0,0)" }}
    />
  );
}
