import Tabs from "@/components/Tabs";
import VisitorCounter from "@/components/VisitorCounter";
import EffectsController from "@/components/EffectsController";
import { Suspense } from "react";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import FaviconAnimation from "@/components/FaviconAnimation";
import ConfigSync from "@/components/ConfigSync";
import type { HomepageConfig, SiteLayout } from "@/lib/schema/config";
import SiteHeader from "@/components/SiteHeader";
import OnePage from "@/components/OnePage";
import type { WidgetContext } from "@/widgets/types";

function TabsFallback() {
  return (
    <div className="w-full">
      <div className="flex gap-4 justify-center mb-6 border-b border-gray-300 dark:border-gray-700 pb-2">
        <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded relative overflow-hidden animate-shimmer" />
        <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded relative overflow-hidden animate-shimmer" />
      </div>
    </div>
  );
}

/** Page column width per site layout. Full class names, so Tailwind can see them. */
const PAGE_WIDTH: Record<SiteLayout, string> = {
  tabs: "max-w-[870px]",
  sidebar: "max-w-[1180px]",
  onepage: "max-w-[870px]",
  bento: "max-w-[1280px]",
  linkinbio: "max-w-[480px]",
};

/**
 * The whole site, rendered from `config`. Used by `/` (the published config) and by
 * `/admin/preview` (the admin panel's draft, `preview` = true).
 */
export default function SitePage({ config, preview }: { config: HomepageConfig; preview: boolean }) {
  const { name, tagline, titleGradient, taglineGradient: rawTaglineGradient, background, effects, counters, tabs } = config;
  const taglineGradient = rawTaglineGradient.length ? rawTaglineGradient : titleGradient;
  const header = { name, tagline, titleGradient, taglineGradient };

  const site = config.layout.site;
  const width = PAGE_WIDTH[site];
  // Bento lays every tab out as a grid, two widgets per row unless a widget says otherwise.
  const grid = site === "bento" ? { force: true, defaultSpan: 6 } : undefined;

  const bgVars = { '--bg-light': background.base.light, '--bg-dark': background.base.dark } as React.CSSProperties;

  const widgetContext: WidgetContext = {
    gradientBorders: effects.gradientBorders,
    progressGradient: effects.progressGradient,
    progressGradientColors: effects.progressGradientColors,
    titleGradient,
    discordServerId: process.env.DISCORD_SERVER_ID,
    widgetFrame: effects.widgetFrame,
    widgetFrameWidth: effects.widgetFrameWidth,
  };

  return (
    <main className="min-h-screen bg-page relative z-10 overflow-x-clip" style={bgVars}>
      <EffectsController particleEffect={background.effect.type} customScrollbar={effects.customScrollbar} mouseTrail={effects.mouseTrail} mouseTrailColors={effects.mouseTrailColors} reactionFlyer={effects.reactionFlyer} />
      {/* The sidebar layout shows the name in its left column from md up, so the top header is mobile-only there. */}
      <div className={`bg-page pt-6 md:pt-8 pb-3 md:pb-4${site === "sidebar" ? " md:hidden" : ""}`}>
        <div className={`w-full ${width} mx-auto px-4 md:px-8`}>
          <SiteHeader {...header} />
        </div>
      </div>

      <div className={`w-full ${width} mx-auto px-4 md:px-8 pb-8`}>
        <Suspense fallback={<TabsFallback />}>
          {site === "onepage" ? (
            <OnePage tabs={tabs} widgetContext={widgetContext} widthClass={width} grid={grid} />
          ) : (
            <Tabs
              tabs={tabs}
              enableTransitions={effects.tabTransitions}
              widgetContext={widgetContext}
              widthClass={width}
              nav={site === "sidebar" ? "side" : "top"}
              sideHeader={site === "sidebar" ? <SiteHeader {...header} variant="side" /> : undefined}
              hideNavIfSingle={site === "linkinbio"}
              grid={grid}
            />
          )}
        </Suspense>
      </div>

      <div className="fixed bottom-4 left-4 z-30">
        <VisitorCounter showViewers={counters.viewers} showVisitors={counters.visitors} />
      </div>
      <ConfigSync preview={preview} />
      {effects.faviconAnimation && !preview && <FaviconAnimation gradient={titleGradient} />}
      <ThemeSwitcher />
    </main>
  );
}
