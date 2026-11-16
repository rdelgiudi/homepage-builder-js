"use client";

import { useEffect } from "react";
import ParticleBackground from "@/components/ParticleBackground";
import MouseTrail from "@/components/MouseTrail";
import ReactionFlyer from "@/components/ReactionFlyer";

interface EffectsControllerProps {
  /** `background.effect.type` from homepage.json. */
  particleEffect: "none" | "stars" | "comet";
  customScrollbar: boolean;
  mouseTrail: boolean;
  mouseTrailColors?: string[];
  reactionFlyer: boolean;
}

export default function EffectsController({ particleEffect, customScrollbar, mouseTrail, mouseTrailColors, reactionFlyer }: EffectsControllerProps) {
  useEffect(() => {
    document.documentElement.classList.toggle("custom-scrollbar", customScrollbar);
  }, [customScrollbar]);

  return (
    <>
      {particleEffect !== "none" && <ParticleBackground mode={particleEffect} />}
      {mouseTrail && <MouseTrail colors={mouseTrailColors} />}
      {reactionFlyer && <ReactionFlyer />}
    </>
  );
}
