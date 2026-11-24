import type { SiteLanguage } from "@/lib/i18n/languages";
import type { HomepageConfig } from "@/lib/schema/config";
import type { WidgetContext } from "@/widgets/types";

/**
 * The site-wide values every widget gets (`ctx` in render.tsx). Server-side: it reads
 * DISCORD_SERVER_ID. Shared by the site (SitePage) and the stream overlay page, so a widget
 * looks the same in both.
 */
export function widgetContextFor(config: HomepageConfig, language: SiteLanguage): WidgetContext {
  const { effects, titleGradient, postAuthor } = config;
  return {
    gradientBorders: effects.gradientBorders,
    progressGradient: effects.progressGradient,
    progressGradientColors: effects.progressGradientColors,
    progressAnimation: effects.progressAnimation,
    progressSparkles: effects.progressSparkles,
    titleGradient,
    discordServerId: process.env.DISCORD_SERVER_ID,
    widgetFrame: effects.widgetFrame,
    widgetFrameWidth: effects.widgetFrameWidth,
    postAuthor,
    lang: language.current === language.original ? undefined : language.current,
  };
}
