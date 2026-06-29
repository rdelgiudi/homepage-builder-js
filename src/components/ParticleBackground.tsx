"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  color: string;
}

export default function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let particles: Particle[] = [];

    function getCount() {
      return Math.min(Math.floor(window.innerWidth * 0.04), 60);
    }

    function initParticles() {
      const c = getCount();
      const isDark = document.documentElement.classList.contains("dark");
      particles = Array.from({ length: c }, () => ({
        x: Math.random() * (canvas?.width || window.innerWidth),
        y: Math.random() * (canvas?.height || window.innerHeight),
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 3 + 1.5,
        opacity: isDark ? Math.random() * 0.5 + 0.3 : Math.random() * 0.5 + 0.4,
        color: isDark ? "148, 163, 184" : "75, 85, 99",
      }));
    }

    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
      initParticles();
    }

    function animate() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = canvas!.width;
        if (p.x > canvas!.width) p.x = 0;
        if (p.y < 0) p.y = canvas!.height;
        if (p.y > canvas!.height) p.y = 0;

        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${p.color}, ${p.opacity})`;
        ctx!.fill();
      }

      animId = requestAnimationFrame(animate);
    }

    resize();
    window.addEventListener("resize", resize);

    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains("dark");
      for (const p of particles) {
        p.opacity = isDark
          ? Math.random() * 0.5 + 0.3
          : Math.random() * 0.5 + 0.4;
        p.color = isDark ? "148, 163, 184" : "75, 85, 99";
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      observer.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed pointer-events-none z-10"
      style={{ top: 0, right: 0, bottom: 0, left: 0, width: "100vw", height: "100vh" }}
    />
  );
}
