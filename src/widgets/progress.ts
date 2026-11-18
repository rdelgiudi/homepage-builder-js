import type { WidgetContext } from "./types";

/** Used when neither the section, the site's progress bar colors nor the title gradient set any. */
export const DEFAULT_PROGRESS_COLORS = ["#60a5fa", "#a78bfa", "#f472b6", "#a78bfa", "#60a5fa"];

/** Progress bar color stops: the section's own → `effects.progressGradientColors` → title gradient → default. Empty arrays count as unset. */
export function progressColors(own: string[] | undefined, ctx: Pick<WidgetContext, "progressGradientColors" | "titleGradient">): string[] {
  for (const c of [own, ctx.progressGradientColors, ctx.titleGradient]) if (c?.length) return c;
  return DEFAULT_PROGRESS_COLORS;
}

/** A left-to-right `linear-gradient()` from color stops. One stop is repeated, since a gradient needs two. */
export function gradientImage(colors: string[]): string {
  const stops = colors.length === 1 ? [colors[0], colors[0]] : colors.length ? colors : DEFAULT_PROGRESS_COLORS;
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}
