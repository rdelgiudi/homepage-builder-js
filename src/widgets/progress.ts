import type { WidgetContext } from "./types";

/** Used when neither the section, the site's progress bar colors nor the title gradient set any. */
export const DEFAULT_PROGRESS_COLORS = ["#60a5fa", "#a78bfa", "#f472b6", "#a78bfa", "#60a5fa"];

type ProgressContext = Pick<WidgetContext, "progressGradient" | "progressGradientColors" | "progressAnimation" | "progressSparkles" | "titleGradient">;

interface ProgressSection {
  progressColorMode: "site" | "custom";
  progressColors?: string[];
  progressAnimation?: boolean;
  progressSparkles?: boolean;
}

export interface ProgressStyle {
  /** Color stops, or `null` for a plain solid bar (gradient off). */
  colors: string[] | null;
  animate: boolean;
  sparkles: boolean;
}

/**
 * A section's progress bar look. Colors: `custom` → the section's own (empty = the site's), gradient on even
 * when the site has it off; `site` → solid when `effects.progressGradient` is off. The site's colors are `effects.progressGradientColors`
 * → title gradient → default; empty arrays count as unset. Animation and sparkles: the section's tri-state, else
 * the site's. Neither applies to a solid bar.
 */
export function progressStyle(section: ProgressSection, ctx: ProgressContext): ProgressStyle {
  const { progressColorMode: mode } = section;
  const gradient = mode === "custom" || ctx.progressGradient;
  if (!gradient) return { colors: null, animate: false, sparkles: false };
  const sources = mode === "custom" ? [section.progressColors, ctx.progressGradientColors, ctx.titleGradient] : [ctx.progressGradientColors, ctx.titleGradient];
  return {
    colors: sources.find((c) => c?.length) ?? DEFAULT_PROGRESS_COLORS,
    animate: section.progressAnimation ?? ctx.progressAnimation,
    sparkles: section.progressSparkles ?? ctx.progressSparkles,
  };
}

/** A left-to-right `linear-gradient()` from color stops. One stop is repeated, since a gradient needs two. */
export function gradientImage(colors: string[]): string {
  const stops = colors.length === 1 ? [colors[0], colors[0]] : colors.length ? colors : DEFAULT_PROGRESS_COLORS;
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}
