"use client";

import { useEffect } from "react";
import ParticleBackground from "@/components/ParticleBackground";
import AmbientEffects from "@/components/AmbientEffects";
import MouseTrail from "@/components/MouseTrail";
import ReactionFlyer from "@/components/ReactionFlyer";
import type { ParticleEffect } from "@/lib/schema/config";

interface EffectsControllerProps {
  /** `background.effect` from homepage.json. */
  particles: { type: ParticleEffect; density: number; speed: number; color?: string };
  /** Title gradient — the aurora effect's colours when it has none of its own. */
  palette: string[];
  customScrollbar: boolean;
  mouseTrail: boolean;
  mouseTrailColors?: string[];
  reactionFlyer: boolean;
}

export default function EffectsController({ particles, palette, customScrollbar, mouseTrail, mouseTrailColors, reactionFlyer }: EffectsControllerProps) {
  useEffect(() => {
    document.documentElement.classList.toggle("custom-scrollbar", customScrollbar);
  }, [customScrollbar]);

  const { type, density, speed, color } = particles;
  return (
    <>
      {(type === "stars" || type === "comet") && <ParticleBackground mode={type} density={density} speed={speed} color={color} />}
      {(type === "snow" || type === "fireflies" || type === "constellation" || type === "aurora") && <AmbientEffects mode={type} density={density} speed={speed} color={color} palette={palette} />}
      {mouseTrail && <MouseTrail colors={mouseTrailColors} />}
      {reactionFlyer && <ReactionFlyer />}
    </>
  );
}
