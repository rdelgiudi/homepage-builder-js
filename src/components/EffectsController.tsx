"use client";

import { useEffect } from "react";
import ParticleBackground from "@/components/ParticleBackground";

interface EffectsConfig {
  particleBackground?: boolean;
  particleEffect?: string;
  gradientBorders?: boolean;
  tabTransitions?: boolean;
  customScrollbar?: boolean;
}

interface EffectsControllerProps {
  effects?: EffectsConfig;
}

export default function EffectsController({ effects }: EffectsControllerProps) {
  useEffect(() => {
    if (effects?.customScrollbar) {
      document.documentElement.classList.add("custom-scrollbar");
    } else {
      document.documentElement.classList.remove("custom-scrollbar");
    }
  }, [effects?.customScrollbar]);

  return (
    <>
      {effects?.particleBackground && <ParticleBackground mode={(effects?.particleEffect as "stars" | "comet") || "stars"} />}
    </>
  );
}
