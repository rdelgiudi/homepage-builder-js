import Tabs from "@/components/Tabs";
import VisitorCounter from "@/components/VisitorCounter";
import EffectsController from "@/components/EffectsController";
import { Suspense } from "react";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import FaviconAnimation from "@/components/FaviconAnimation";
import ConfigSync from "@/components/ConfigSync";
import type { BannerConfig, BannerOptions, HomepageConfig, SiteLayout } from "@/lib/schema/config";
import { bannerOptions } from "@/lib/banner";
import Banner, { type BannerSet, type BannerSetup } from "@/components/Banner";
import SiteHeader from "@/components/SiteHeader";
import BackgroundLayer from "@/components/BackgroundLayer";
import { slugify } from "@/lib/schema/migrate";
import OnePage from "@/components/OnePage";
import { COLUMN_GRID, LAYOUT_FEATURES, bottomNav, gridOptions, pinnedTabId } from "@/lib/layouts";
import { widgetContextFor } from "@/lib/widget-context";
import TabSections from "@/components/TabSections";

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
  masonry: "max-w-[1280px]",
  profile: "max-w-[1240px]",
};
/** `layout.fullWidth` (bento, masonry): no cap, the page uses the whole screen. */
const FULL_WIDTH = "max-w-none";

function headerProps(config: HomepageConfig, homeHref?: string) {
  const { name, tagline, titleGradient, taglineGradient } = config;
  return { name, tagline, titleGradient, taglineGradient: taglineGradient.length ? taglineGradient : titleGradient, homeHref };
}

/** The banner of a page with this config: its settings as the layout applies them, and its title. */
function bannerSetup(config: HomepageConfig, homeHref?: string): BannerSetup {
  const header = headerProps(config, homeHref);
  const { options, phone } = bannerOptions(config.layout, config.banner);
  const set = (o: BannerOptions): BannerSet => ({ options: o, brand: <SiteHeader {...header} banner={o} variant={o.arrangement === "inline" ? "bar" : "top"} /> });
  return { ...set(options), ...(phone && { phone: set(phone) }) };
}

/** The floating light/dark switch, on the screens whose banner doesn't have it. */
function FloatingThemeSwitch({ banner }: { banner: BannerConfig }) {
  const desktop = banner.themeSwitch === "floating";
  const phone = (banner.phone ?? banner).themeSwitch === "floating";
  if (!desktop && !phone) return null;
  return (
    <div className={!desktop ? "md:hidden" : !phone ? "max-md:hidden" : undefined}>
      <ThemeSwitcher />
    </div>
  );
}

/**
 * Everything around the content: page colour, background layer, effects, the banner (unless
 * the content draws it, with its tab bar), counters, live config refresh and the theme switch. Shared by the site (`SitePage`)
 * and the blog post pages.
 */
export function SiteShell({
  config,
  preview,
  width,
  ownBanner = false,
  tabBackgrounds = false,
  bottomNav = false,
  homeHref,
  children,
}: {
  config: HomepageConfig;
  preview: boolean;
  width: string;
  /** `children` draw the banner themselves (Tabs and OnePage: the tab bar is part of it). */
  ownBanner?: boolean;
  /** Follow per-tab backgrounds (`?tab=`). Off for pages without tabs. */
  tabBackgrounds?: boolean;
  /** Phones show the tab bar at the bottom: lift the counters, theme switch and page end above it. */
  bottomNav?: boolean;
  /** Not on the homepage: the site name links back to it. */
  homeHref?: string;
  children: React.ReactNode;
}) {
  const { titleGradient, background, effects, counters, tabs } = config;

  const { surface } = background;
  const pageVars = {
    '--bg-light': background.base.light,
    '--bg-dark': background.base.dark,
    '--surface-header': surface.header / 100,
    '--surface-cards': surface.cards / 100,
    '--surface-blur': `${surface.blur}px`,
  } as React.CSSProperties;

  return (
    <main
      className="min-h-screen bg-page relative z-10 overflow-x-clip"
      style={pageVars}
      data-card-opacity={surface.cards < 100 ? "" : undefined}
      data-bottom-nav={bottomNav ? "" : undefined}
    >
      <Suspense fallback={null}>
        <BackgroundLayer
          base={background.base}
          overlay={background.overlay}
          tabOverrides={tabBackgrounds ? tabs.flatMap((t) => (t.background ? [{ slug: slugify(t.label), base: t.background }] : [])) : []}
          firstTabSlug={tabs[0] ? slugify(tabs[0].label) : ""}
        />
      </Suspense>
      <EffectsController particles={background.effect} palette={titleGradient} customScrollbar={effects.customScrollbar} mouseTrail={effects.mouseTrail} mouseTrailColors={effects.mouseTrailColors} reactionFlyer={effects.reactionFlyer} />
      <div className={`w-full ${width} mx-auto px-4 md:px-8 pb-8`}>
        {!ownBanner && <Banner {...bannerSetup(config, homeHref)} widthClass={width} />}
        {children}
      </div>

      <div className="site-fixed-bottom fixed bottom-4 left-4 z-30">
        <VisitorCounter showViewers={counters.viewers} showVisitors={counters.visitors} />
      </div>
      <ConfigSync preview={preview} />
      {effects.faviconAnimation && !preview && <FaviconAnimation gradient={titleGradient} />}
      <FloatingThemeSwitch banner={config.banner} />
    </main>
  );
}

/**
 * The whole site, rendered from `config`. Used by `/` (the published config) and by
 * `/admin/preview` (the admin panel's draft, `preview` = true). For another page, `config`
 * is that page's view (`pageView()` in lib/pages.ts: its tabs, everything else shared) and
 * `onPage` is set, which makes the site name link back to the homepage.
 */
export default function SitePage({ config, preview, onPage = false }: { config: HomepageConfig; preview: boolean; onPage?: boolean }) {
  const { effects, tabs } = config;
  const homeHref = onPage ? "/" : undefined;
  const banner = bannerSetup(config, homeHref);

  const site = config.layout.site;
  const width = config.layout.fullWidth && (site === "bento" || site === "masonry") ? FULL_WIDTH : PAGE_WIDTH[site];
  // What the layout does with each tab's own settings (forced grid / stack, default width): lib/layouts.ts.
  const grid = gridOptions(config.layout);
  const features = LAYOUT_FEATURES[site];
  // Profile layout: one tab is the column beside the others and leaves the tab bar.
  const pinnedId = pinnedTabId(config);
  const pinned = pinnedId ? tabs.find((t) => t.id === pinnedId) : undefined;
  const barTabs = pinned ? tabs.filter((t) => t !== pinned) : tabs;
  const phoneBottomNav = bottomNav(config.layout, barTabs.length);

  const widgetContext = preview ? { ...widgetContextFor(config), preview: true } : widgetContextFor(config);

  return (
    // The one-page layout shows every tab at once, so there is no "open tab" background to follow.
    <SiteShell config={config} preview={preview} width={width} ownBanner={tabs.length > 0} tabBackgrounds={features.tabBackground} bottomNav={phoneBottomNav} homeHref={homeHref}>
      <Suspense fallback={<TabsFallback />}>
        {site === "onepage" ? (
          <OnePage tabs={tabs} banner={banner} widgetContext={widgetContext} widthClass={width} grid={grid} headings={config.layout.sectionHeadings} />
        ) : (
          <Tabs
            tabs={barTabs}
            banner={banner}
            enableTransitions={effects.tabTransitions}
            widgetContext={widgetContext}
            widthClass={width}
            nav={site === "sidebar" ? "side" : "top"}
            sideHeader={site === "sidebar" ? <SiteHeader {...headerProps(config, homeHref)} banner={banner.options} variant="side" /> : undefined}
            hideNavIfSingle={features.tabNav === "multiple"}
            grid={grid}
            mobileNav={phoneBottomNav ? "bottom" : "menu"}
            uniformNav={features.uniformNav}
            column={pinned ? <TabSections tab={pinned} widgetContext={widgetContext} grid={COLUMN_GRID} /> : undefined}
          />
        )}
      </Suspense>
    </SiteShell>
  );
}
