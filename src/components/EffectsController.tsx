"use client";

import { useEffect } from "react";
import ParticleBackground from "@/components/ParticleBackground";

interface EffectsConfig {
  particleBackground?: boolean;
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
      {effects?.particleBackground && <ParticleBackground />}
    </>
  );
}
