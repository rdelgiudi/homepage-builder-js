"use client";

import { useEffect, useRef } from "react";

interface MouseTrailProps {
  colors?: string[];
}

interface TrailPoint {
  x: number;
  y: number;
  life: number;
}

const MAX_POINTS = 40;
const TRAIL_SECONDS = 0.4;
const MAX_WIDTH = 6;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export default function MouseTrail({ colors }: MouseTrailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorsRef = useRef<string[]>(colors || []);
  colorsRef.current = colors || [];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId = 0;
    let points: TrailPoint[] = [];
    let lastX = 0;
    let lastY = 0;
    let hasLast = false;
    let moved = false;

    function palette(): [number, number, number][] {
      const c = colorsRef.current;
      if (!c || c.length === 0) return [[96, 165, 250], [167, 139, 250], [244, 114, 182]];
      return c.map(hexToRgb);
    }

    // Interpolated color across the palette at position t (0..1)
    function colorAt(t: number): [number, number, number] {
      const pal = palette();
      if (pal.length === 1) return pal[0];
      const scaled = t * (pal.length - 1);
      const i = Math.min(pal.length - 2, Math.floor(scaled));
      const f = scaled - i;
      const a = pal[i];
      const b = pal[i + 1];
      return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)];
    }

    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
    }

    function onMove(e: MouseEvent) {
      lastX = e.clientX;
      lastY = e.clientY;
      hasLast = true;
      moved = true;
    }

    let lastTime = 0;
    function animate(now: number) {
      const dt = lastTime ? Math.min((now - lastTime) / (1000 / 60), 3) : 1;
      lastTime = now;

      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);

      if (hasLast && moved) {
        points.push({ x: lastX, y: lastY, life: 1 });
        if (points.length > MAX_POINTS) points.shift();
        moved = false;
      }

      const decay = dt / (60 * TRAIL_SECONDS);
      for (const p of points) p.life -= decay;
      points = points.filter((p) => p.life > 0);

      if (points.length > 1) {
        const head = points[points.length - 1];
        const tail = points[0];
        const span = Math.hypot(head.x - tail.x, head.y - tail.y);

        ctx!.lineCap = "round";
        ctx!.lineJoin = "round";

        if (span >= 1) {
          // One gradient path for the whole trail, stroked twice (glow + core)
          const grad = ctx!.createLinearGradient(tail.x, tail.y, head.x, head.y);
          const STOPS = 8;
          for (let s = 0; s <= STOPS; s++) {
            const t = s / STOPS;
            const [r, g, b] = colorAt(t);
            const alpha = Math.pow(t, 1.4) * 0.9;
            grad.addColorStop(t, `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`);
          }

          ctx!.beginPath();
          ctx!.moveTo(tail.x, tail.y);
          for (let i = 1; i < points.length; i++) ctx!.lineTo(points[i].x, points[i].y);

          // Soft glow pass
          ctx!.globalAlpha = 0.35;
          ctx!.strokeStyle = grad;
          ctx!.lineWidth = MAX_WIDTH;
          ctx!.stroke();
          // Bright core pass
          ctx!.globalAlpha = 1;
          ctx!.lineWidth = MAX_WIDTH * 0.4;
          ctx!.stroke();
        }
      }

      animId = requestAnimationFrame(animate);
    }

    function startLoop() {
      if (!animId) animate(performance.now());
    }

    resize();
    startLoop();

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMove);

    const visibilityHandler = () => {
      if (document.hidden) {
        cancelAnimationFrame(animId);
        animId = 0;
        lastTime = 0;
      } else {
        startLoop();
      }
    };
    document.addEventListener("visibilitychange", visibilityHandler);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("visibilitychange", visibilityHandler);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed pointer-events-none z-50"
      style={{ top: 0, right: 0, bottom: 0, left: 0, width: "100vw", height: "100vh", transform: "translate3d(0,0,0)" }}
    />
  );
}
