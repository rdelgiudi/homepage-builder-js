/**
 * Single source of truth for homepage.json (config v2).
 * Types are inferred from these schemas; defaults live here and nowhere else.
 */
import { z } from "zod";
import { SectionSchema } from "@/widgets/meta";

export const CONFIG_VERSION = 2;

const GradientSchema = z.array(z.string());

export const EffectsSchema = z.object({
  gradientBorders: z.boolean().default(true).meta({ title: "Gradient borders on hover" }),
  tabTransitions: z.boolean().default(true).meta({ title: "Tab transitions" }),
  customScrollbar: z.boolean().default(true).meta({ title: "Custom scrollbar" }),
  progressGradient: z.boolean().default(true).meta({ title: "Music progress gradient + sparkles" }),
  progressGradientColors: GradientSchema.optional().meta({ title: "Progress bar colors", ui: "gradient", description: "Falls back to the title gradient" }),
  widgetFrame: z.boolean().default(false).meta({ title: "Gradient frame around widgets" }),
  widgetFrameWidth: z.number().min(0).max(20).default(2).meta({ title: "Frame width (px)" }),
  mouseTrail: z.boolean().default(false).meta({ title: "Mouse trail" }),
  mouseTrailColors: GradientSchema.optional().meta({ title: "Mouse trail colors", ui: "gradient", description: "Falls back to the title gradient" }),
  faviconAnimation: z.boolean().default(true).meta({ title: "Animated favicon" }),
  reactionFlyer: z.boolean().default(true).meta({ title: "Flying emoji on reactions" }),
});

export const BackgroundSchema = z.object({
  /** What fills the page. Only `solid` exists so far; more base types are additive. */
  base: z
    .object({
      type: z.literal("solid").default("solid"),
      light: z.string().default("#f3f4f6").meta({ title: "Light mode color", ui: "color" }),
      dark: z.string().default("#111827").meta({ title: "Dark mode color", ui: "color" }),
    })
    .prefault({}),
  /** Animated layer drawn over the base. */
  effect: z
    .object({
      type: z.enum(["none", "stars", "comet"]).default("stars").meta({ title: "Particle effect" }),
    })
    .prefault({}),
});

export const LayoutSchema = z.object({
  /** Site shell. Only `tabs` exists so far; more layouts are additive. */
  site: z.enum(["tabs"]).default("tabs").meta({ title: "Site layout" }),
});

export const CountersSchema = z.object({
  viewers: z.boolean().default(true).meta({ title: "Show live viewer count" }),
  visitors: z.boolean().default(true).meta({ title: "Show total visitor count" }),
});

export const TabSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).meta({ title: "Label" }),
  icon: z.string().optional().meta({ title: "Icon", ui: "icon", description: "Emoji or image URL" }),
  invertDark: z.boolean().optional().meta({ title: "Invert icon in dark mode" }),
  /** How sections are arranged. Only `stack` exists so far. */
  layout: z.enum(["stack"]).default("stack").meta({ title: "Tab layout" }),
  sections: z.array(SectionSchema).default([]),
});

export const ConfigSchema = z.object({
  version: z.literal(CONFIG_VERSION),
  name: z.string().default("Homepage").meta({ title: "Site name" }),
  tagline: z.string().default("Welcome").meta({ title: "Tagline" }),
  favicon: z.string().default("").meta({ title: "Favicon URL", description: "Empty = animated gradient ring" }),
  titleGradient: GradientSchema.default([]).meta({ title: "Title gradient", ui: "gradient", description: "Empty = solid color" }),
  taglineGradient: GradientSchema.default([]).meta({ title: "Tagline gradient", ui: "gradient", description: "Empty = same as title" }),
  layout: LayoutSchema.prefault({}),
  background: BackgroundSchema.prefault({}),
  effects: EffectsSchema.prefault({}),
  counters: CountersSchema.prefault({}),
  tabs: z.array(TabSchema).default([]),
});

export type HomepageConfig = z.infer<typeof ConfigSchema>;
export type EffectsConfig = z.infer<typeof EffectsSchema>;
export type BackgroundConfig = z.infer<typeof BackgroundSchema>;
export type LayoutConfig = z.infer<typeof LayoutSchema>;
export type CountersConfig = z.infer<typeof CountersSchema>;
export type Tab = z.infer<typeof TabSchema>;
