"use client";

import { useEffect, useRef } from "react";

const FALLBACK_GRADIENT = ["#60a5fa", "#a78bfa", "#f472b6"];

interface Props {
  gradient?: string[];
}

export default function FaviconAnimation({ gradient }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);

  useEffect(() => {
    const colors =
      gradient && gradient.length > 0 ? gradient : FALLBACK_GRADIENT;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const link =
      document.querySelector<HTMLLinkElement>('link[rel*="icon"]');
    if (!link) return;

    const SIZE = 32;
    const CX = SIZE / 2;
    const CY = SIZE / 2;
    const R = 12;
    canvas.width = SIZE;
    canvas.height = SIZE;

    let angle = 0;
    let running = true;

    function draw() {
      if (!running) return;
      const c = ctx!;
      c.clearRect(0, 0, SIZE, SIZE);

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

      link!.href = canvas!.toDataURL("image/png");
      angle += 0.03;
      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);

    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
    };
  }, [gradient]);

  return <canvas ref={canvasRef} hidden />;
}
