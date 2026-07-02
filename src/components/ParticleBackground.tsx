"use client";

import { useEffect, useRef } from "react";

type ParticleMode = "stars" | "comet";

interface StarsParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  baseOpacity: number;
  color: string;
  twinkleSpeed: number;
  twinklePhase: number;
}

interface CometParticle {
  x: number;
  y: number;
  z: number;
  speed: number;
  baseSize: number;
  brightness: number;
  color: string;
  r: number;
  g: number;
  b: number;
  prevSx: number;
  prevSy: number;
  hasPrev: boolean;
}

type Particle = StarsParticle | CometParticle;

function drawComet(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, alpha: number, brightness: number, baseR: number, baseG: number, baseB: number, dirAngle: number, stretch: number) {
  const spikes = 4;
  const headLen = 0.7 + 0.3 * (1 - stretch);
  const tailLen = 1 + 1.5 * stretch;
  const sideLen = 1 + 0.3 * stretch;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(dirAngle);

  const spread = size * 0.15;
  const tailTip = -(size * tailLen);
  const headTip = size * headLen;

  const fadeStart = 0.5 * (1 - stretch);
  const grad = ctx.createLinearGradient(tailTip, 0, headTip, 0);
  const cDim = stretch > 0.01
    ? `rgba(${Math.round(baseR * brightness * 0.15)}, ${Math.round(baseG * brightness * 0.15)}, ${Math.round(baseB * brightness * 0.15)}, ${alpha * 0.3})`
    : `rgba(${Math.round(baseR * brightness)}, ${Math.round(baseG * brightness)}, ${Math.round(baseB * brightness)}, ${alpha})`;
  const cMid = `rgba(${Math.round(baseR * brightness)}, ${Math.round(baseG * brightness)}, ${Math.round(baseB * brightness)}, ${alpha})`;
  grad.addColorStop(0, cDim);
  grad.addColorStop(fadeStart, cMid);
  grad.addColorStop(1, cMid);

  ctx.beginPath();

  for (let i = 0; i < spikes * 2; i++) {
    const spikeAngle = (Math.PI * i) / spikes - Math.PI / 2;
    const isOuter = i % 2 === 0;
    const cosA = Math.cos(spikeAngle);

    let baseLen: number;
    if (cosA > 0.8) baseLen = headLen;
    else if (cosA < -0.8) baseLen = tailLen;
    else baseLen = sideLen;

    const len = isOuter ? size * baseLen : size * baseLen * 0.3;
    const w = isOuter ? spread * (0.3 + 0.7 * (1 - Math.abs(Math.sin(spikeAngle)))) : spread * 0.3;
    const px = len * Math.cos(spikeAngle);
    const py = w * Math.sin(spikeAngle);

    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }

  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();
}

const FOCAL = 400;
const MIN_Z = 0.05;
const FAR_Z = 3;
function project(w: number, h: number, px: number, py: number, z: number) {
  const scale = FOCAL / z;
  return { sx: w / 2 + px * scale, sy: h / 2 + py * scale, scale };
}

export default function ParticleBackground({ mode = "stars" }: { mode?: ParticleMode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

  let animId: number;
  let particles: Particle[] = [];

    function getCount() {
      const isMobile = window.innerWidth < 640;
      const multiplier = isMobile ? 0.025 : 0.04;
      return Math.min(Math.floor(window.innerWidth * multiplier), isMobile ? 30 : 60);
    }

    function initStars() {
      const c = getCount();
      const w = canvas!.width;
      const h = canvas!.height;
      const isDark = document.documentElement.classList.contains("dark");
      particles = Array.from({ length: c }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 2.5 + 1,
        baseOpacity: isDark ? Math.random() * 0.5 + 0.3 : Math.random() * 0.5 + 0.4,
        color: isDark ? "148, 163, 184" : "75, 85, 99",
        twinkleSpeed: Math.random() * 0.004 + 0.002,
        twinklePhase: Math.random() * Math.PI * 2,
      })) satisfies StarsParticle[];
    }

    function initComets() {
      const c = getCount();
      const isDark = document.documentElement.classList.contains("dark");
      const color = isDark ? "148, 163, 184" : "75, 85, 99";
      const [r, g, b] = color.split(", ").map(s => parseInt(s));
      particles = Array.from({ length: c }, () => ({
        x: (Math.random() - 0.5) * 1.6,
        y: (Math.random() - 0.5) * 1.6,
        z: Math.random() * (FAR_Z - 0.3) + 0.3,
        speed: Math.random() * 0.006 + 0.004,
        baseSize: Math.random() * 0.025 + 0.005,
        brightness: isDark ? Math.random() * 0.7 + 0.3 : Math.random() * 0.6 + 0.4,
        color,
        r: r!,
        g: g!,
        b: b!,
        prevSx: 0,
        prevSy: 0,
        hasPrev: false,
      })) satisfies CometParticle[];
    }

    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
      if (mode === "comet") initComets();
      else initStars();
    }

    function animateStars(now: number) {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);

      for (const p of particles) {
        const sp = p as StarsParticle;
        sp.x += sp.vx;
        sp.y += sp.vy;
        if (sp.x < 0) sp.x = canvas!.width;
        if (sp.x > canvas!.width) sp.x = 0;
        if (sp.y < 0) sp.y = canvas!.height;
        if (sp.y > canvas!.height) sp.y = 0;

        const twinkle = 0.8 + 0.2 * Math.sin(now * sp.twinkleSpeed + sp.twinklePhase);
        const opacity = sp.baseOpacity * twinkle;

        ctx!.beginPath();
        ctx!.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${sp.color}, ${opacity})`;
        ctx!.fill();
      }

      animId = requestAnimationFrame(animateStars);
    }

    function animateComets(now: number) {
      const w = canvas!.width;
      const h = canvas!.height;

      ctx!.clearRect(0, 0, w, h);

      for (const p of particles) {
        const cp = p as CometParticle;
        cp.z -= cp.speed;

        if (cp.z < MIN_Z) {
          cp.z = Math.random() * (FAR_Z - 0.5) + 0.5;
          cp.x = (Math.random() - 0.5) * 1.6;
          cp.y = (Math.random() - 0.5) * 1.6;
          cp.baseSize = Math.random() * 0.025 + 0.005;
          cp.hasPrev = false;
          continue;
        }

        const { sx, sy, scale } = project(w, h, cp.x, cp.y, cp.z);
        if (sx < -100 || sx > w + 100 || sy < -100 || sy > h + 100) {
          cp.hasPrev = false;
          continue;
        }

        if (cp.hasPrev) {
          ctx!.beginPath();
          ctx!.moveTo(cp.prevSx, cp.prevSy);
          ctx!.lineTo(sx, sy);
          ctx!.strokeStyle = `rgba(${cp.r * cp.brightness | 0}, ${cp.g * cp.brightness | 0}, ${cp.b * cp.brightness | 0}, 0.4)`;
          ctx!.lineWidth = 1.5;
          ctx!.stroke();
        }
        cp.prevSx = sx;
        cp.prevSy = sy;
        cp.hasPrev = true;

        const size = cp.baseSize * scale;
        const edgeAlpha = Math.min(1, (cp.z - MIN_Z) / 0.3);
        const starBrightness = cp.brightness;
        const dirAngle = Math.atan2(sy - h / 2, sx - w / 2);
        const radialDist = Math.sqrt(cp.x * cp.x + cp.y * cp.y);
        const stretch = Math.min(1, radialDist / 0.4);

        drawComet(ctx!, sx, sy, size, edgeAlpha, starBrightness, cp.r, cp.g, cp.b, dirAngle, stretch);
      }

      animId = requestAnimationFrame(animateComets);
    }

    function startLoop() {
      if (mode === "comet") animateComets(performance.now());
      else animateStars(performance.now());
    }

    resize();
    startLoop();

    window.addEventListener("resize", resize);

    const visibilityHandler = () => {
      if (document.hidden) {
        cancelAnimationFrame(animId);
        animId = 0;
      } else if (!animId) {
        startLoop();
      }
    };
    document.addEventListener("visibilitychange", visibilityHandler);

    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains("dark");
      const newColor = isDark ? "148, 163, 184" : "75, 85, 99";
      const [nr, ng, nb] = newColor.split(", ").map(s => parseInt(s));
      for (const p of particles) {
        if (mode === "comet") {
          const cp = p as CometParticle;
          cp.brightness = isDark ? Math.random() * 0.7 + 0.3 : Math.random() * 0.6 + 0.4;
          cp.r = nr!;
          cp.g = ng!;
          cp.b = nb!;
        } else {
          const sp = p as StarsParticle;
          sp.baseOpacity = isDark ? Math.random() * 0.5 + 0.3 : Math.random() * 0.5 + 0.4;
        }
        p.color = newColor;
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", visibilityHandler);
      observer.disconnect();
    };
  }, [mode]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed pointer-events-none -z-10"
      style={{ top: 0, right: 0, bottom: 0, left: 0, width: "100vw", height: "100vh", transform: "translate3d(0,0,0)" }}
    />
  );
}
