import Tabs from "@/components/Tabs";
import VisitorCounter from "@/components/VisitorCounter";
import EffectsController from "@/components/EffectsController";
import { Suspense } from "react";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import FaviconAnimation from "@/components/FaviconAnimation";
import ConfigSync from "@/components/ConfigSync";
import type { HomepageConfig, SiteLayout } from "@/lib/schema/config";
import SiteHeader from "@/components/SiteHeader";
import BackgroundLayer from "@/components/BackgroundLayer";
import { slugify } from "@/lib/schema/migrate";
import OnePage from "@/components/OnePage";
import type { WidgetContext } from "@/widgets/types";
import { LAYOUT_FEATURES, gridOptions } from "@/lib/layouts";

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
export const PAGE_WIDTH: Record<SiteLayout, string> = {
  tabs: "max-w-[870px]",
  sidebar: "max-w-[1180px]",
  onepage: "max-w-[870px]",
  bento: "max-w-[1280px]",
  linkinbio: "max-w-[480px]",
};

/**
 * Everything around the content: page colour, background layer, effects, the name/tagline
 * header, counters, live config refresh and the theme switch. Shared by the site (`SitePage`)
 * and the blog post pages.
 */
export function SiteShell({
  config,
  preview,
  width,
  hideHeaderFromMd = false,
  tabBackgrounds = false,
  children,
}: {
  config: HomepageConfig;
  preview: boolean;
  width: string;
  /** The sidebar layout shows the name in its own left column from md up. */
  hideHeaderFromMd?: boolean;
  /** Follow per-tab backgrounds (`?tab=`). Off for pages without tabs. */
  tabBackgrounds?: boolean;
  children: React.ReactNode;
}) {
  const { name, tagline, titleGradient, taglineGradient: rawTaglineGradient, background, effects, counters, tabs } = config;
  const taglineGradient = rawTaglineGradient.length ? rawTaglineGradient : titleGradient;

  const { surface } = background;
  const pageVars = {
    '--bg-light': background.base.light,
    '--bg-dark': background.base.dark,
    '--surface-header': surface.header / 100,
    '--surface-cards': surface.cards / 100,
    '--surface-blur': `${surface.blur}px`,
  } as React.CSSProperties;

  return (
    <main className="min-h-screen bg-page relative z-10 overflow-x-clip" style={pageVars} data-card-opacity={surface.cards < 100 ? "" : undefined}>
      <Suspense fallback={null}>
        <BackgroundLayer
          base={background.base}
          overlay={background.overlay}
          tabOverrides={tabBackgrounds ? tabs.flatMap((t) => (t.background ? [{ slug: slugify(t.label), base: t.background }] : [])) : []}
          firstTabSlug={tabs[0] ? slugify(tabs[0].label) : ""}
        />
      </Suspense>
      <EffectsController particles={background.effect} palette={titleGradient} customScrollbar={effects.customScrollbar} mouseTrail={effects.mouseTrail} mouseTrailColors={effects.mouseTrailColors} reactionFlyer={effects.reactionFlyer} />
      <div className={`bg-header pt-6 md:pt-8 pb-3 md:pb-4${hideHeaderFromMd ? " md:hidden" : ""}`}>
        <div className={`w-full ${width} mx-auto px-4 md:px-8`}>
          <SiteHeader name={name} tagline={tagline} titleGradient={titleGradient} taglineGradient={taglineGradient} />
        </div>
      </div>

      <div className={`w-full ${width} mx-auto px-4 md:px-8 pb-8`}>{children}</div>

      <div className="fixed bottom-4 left-4 z-30">
        <VisitorCounter showViewers={counters.viewers} showVisitors={counters.visitors} />
      </div>
      <ConfigSync preview={preview} />
      {effects.faviconAnimation && !preview && <FaviconAnimation gradient={titleGradient} />}
      <ThemeSwitcher />
    </main>
  );
}

/**
 * The whole site, rendered from `config`. Used by `/` (the published config) and by
 * `/admin/preview` (the admin panel's draft, `preview` = true).
 */
export default function SitePage({ config, preview }: { config: HomepageConfig; preview: boolean }) {
  const { name, tagline, titleGradient, taglineGradient: rawTaglineGradient, effects, tabs } = config;
  const taglineGradient = rawTaglineGradient.length ? rawTaglineGradient : titleGradient;
  const header = { name, tagline, titleGradient, taglineGradient };

  const site = config.layout.site;
  const width = PAGE_WIDTH[site];
  // What the layout does with each tab's own settings (forced grid / stack, default width): lib/layouts.ts.
  const grid = gridOptions(config.layout);
  const features = LAYOUT_FEATURES[site];

  const widgetContext: WidgetContext = {
    gradientBorders: effects.gradientBorders,
    progressGradient: effects.progressGradient,
    progressGradientColors: effects.progressGradientColors,
    progressAnimation: effects.progressAnimation,
    progressSparkles: effects.progressSparkles,
    titleGradient,
    discordServerId: process.env.DISCORD_SERVER_ID,
    widgetFrame: effects.widgetFrame,
    widgetFrameWidth: effects.widgetFrameWidth,
  };

  return (
    // The one-page layout shows every tab at once, so there is no "open tab" background to follow.
    <SiteShell config={config} preview={preview} width={width} hideHeaderFromMd={site === "sidebar"} tabBackgrounds={features.tabBackground}>
      <Suspense fallback={<TabsFallback />}>
        {site === "onepage" ? (
          <OnePage tabs={tabs} widgetContext={widgetContext} widthClass={width} grid={grid} headings={config.layout.sectionHeadings} />
        ) : (
          <Tabs
            tabs={tabs}
            enableTransitions={effects.tabTransitions}
            widgetContext={widgetContext}
            widthClass={width}
            nav={site === "sidebar" ? "side" : "top"}
            sideHeader={site === "sidebar" ? <SiteHeader {...header} variant="side" /> : undefined}
            hideNavIfSingle={features.tabNav === "multiple"}
            grid={grid}
          />
        )}
      </Suspense>
    </SiteShell>
  );
}
