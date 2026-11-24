"use client";

import type { ReactNode, RefObject } from "react";
import type { BannerConfig } from "@/lib/schema/config";
import { splitTabs } from "@/lib/banner";
import TabStrip, { type NavItem } from "./TabStrip";
import ThemeSwitcher from "./ThemeSwitcher";
import { useBannerScroll } from "./useBannerScroll";

/** What SitePage prepares: the settings as the layout applies them, and the title drawn for them. */
export interface BannerSetup {
  /** From `bannerOptions()`. */
  options: BannerConfig;
  /** <SiteHeader>, `bar` variant when the title shares a row with the tabs. */
  brand: ReactNode;
}

export interface BannerNav {
  variant: "tabs" | "uniform" | "jump";
  items: NavItem[];
  activeId: string;
  onSelect: (id: string) => void;
  label: string;
  /** Phones: `menu` button + drawer, the same `strip` as on wide screens, or `none` (bar at the bottom of the screen). */
  phone: "menu" | "strip" | "none";
  menuButton?: ReactNode;
  /** The open tab, shown beside the menu button. */
  current?: ReactNode;
}

interface BannerProps extends BannerSetup {
  widthClass: string;
  /** Unset = a page without tabs (a blog post), or only one tab in a layout that then shows none. */
  nav?: BannerNav;
  /** Sidebar layout: from md up the left column replaces it. */
  phonesOnly?: boolean;
  /** The row with the menu button: the drawer opens level with it. */
  barRef?: RefObject<HTMLDivElement | null>;
}

// Out of the page column to the window's edges (main clips what the scrollbar adds).
const BLEED = "w-screen ml-[calc(50%-50vw)]";
const EDGE = "border-b border-gray-300 dark:border-gray-700";
// Back in view while the keyboard is in it. Not `focus-within`: a clicked tab keeps the focus.
const AUTOHIDE = "transition-transform duration-300 ease-out motion-reduce:transition-none has-[:focus-visible]:translate-y-0";

/**
 * The top of every page: title (name or logo), tagline, tab bar and, if set, the light/dark
 * switch. Two arrangements (title above the tabs, or all in one row) × three ways to scroll
 * (`banner.scroll`); the same component with or without tabs. Nothing in here may depend on
 * `layout.site`: that is settled before, in lib/banner.ts.
 */
export default function Banner({ options, brand, widthClass, nav, phonesOnly = false, barRef }: BannerProps) {
  const { setElement, away, hidden } = useBannerScroll(options.scroll);
  const width = options.fullWidth ? "max-w-none" : widthClass;
  const keepTabs = options.scroll === "tabs";
  const inBanner = options.themeSwitch === "banner";
  const scope = phonesOnly ? " md:hidden" : "";
  const autohide = options.scroll === "hide" ? ` ${AUTOHIDE}${hidden ? " -translate-y-full" : ""}` : "";

  const strip = (items: NavItem[], align: BannerConfig["tabsPosition"], className: string, tight = false) =>
    nav && items.length > 0 && (
      <TabStrip items={items} activeId={nav.activeId} onSelect={nav.onSelect} variant={nav.variant} align={align} label={nav.label} tight={tight} className={className} />
    );

  // ----- title and tabs in one row -----
  if (options.arrangement === "inline") {
    const position = options.titlePosition;
    const centered = position === "center";
    const [first, rest] = nav && centered ? splitTabs(nav.items) : [[], []];
    const before = !nav ? null : centered ? strip(first, "right", "", true) : position === "right" ? strip(nav.items, options.tabsPosition, "", true) : null;
    const after = !nav ? null : centered ? strip(rest, "left", "", true) : position === "left" ? strip(nav.items, options.tabsPosition, "", true) : null;

    // "Keep the tabs" with no tabs in this row: the whole row scrolls away (on phones too, when
    // the tabs are at the bottom of the screen).
    const sticky = keepTabs && !nav ? "relative" : `sticky top-0${keepTabs && nav?.phone === "none" ? " max-md:static" : ""}`;
    // The title's side(s) that face the tabs.
    const gap = { left: "md:mr-6", center: "md:mx-6", right: "md:ml-6" }[position];
    // Only where the tabs (or, on phones, the open tab's name) take its place.
    const makesRoom = keepTabs && !!nav;

    return (
      <div ref={setElement} className={`${sticky} z-50 ${BLEED} bg-tab-bar ${EDGE}${scope}${autohide}`}>
        <div
          ref={barRef}
          data-away={makesRoom && away ? "" : undefined}
          className={`banner-row ${width} mx-auto px-4 md:px-8 flex items-center gap-3 md:gap-0 min-h-14 md:min-h-16 py-1.5 ${centered ? "md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]" : ""}`}
        >
          {nav?.phone === "menu" && <div className="md:hidden shrink-0">{nav.menuButton}</div>}
          {(before || centered || position === "right") && <div className="hidden md:flex flex-1 min-w-0">{before}</div>}
          <div className="relative flex-1 min-w-0 md:contents">
            <div className={`banner-brand min-w-0 ${centered ? "md:max-w-[40vw]" : "md:max-w-[50%]"} ${gap}`}>
              <div className="min-w-0 md:overflow-hidden">{brand}</div>
            </div>
            {makesRoom && nav.phone === "menu" && <div className="banner-current flex items-center md:hidden">{nav.current}</div>}
          </div>
          {(after || centered || position === "left") && (
            <div className={`${inBanner ? "flex" : "hidden md:flex"} items-center md:flex-1 min-w-0`}>
              <div className="hidden md:flex flex-1 min-w-0">{after}</div>
              {inBanner && position !== "right" && <ThemeSwitcher placement="banner" />}
            </div>
          )}
          {inBanner && position === "right" && <ThemeSwitcher placement="banner" />}
        </div>
        {nav?.phone === "strip" && (
          <div data-banner-keep className="flex md:hidden px-2">
            {strip(nav.items, "center", "", true)}
          </div>
        )}
      </div>
    );
  }

  // ----- title above the tabs -----
  // The switch sits at the end of the tab bar, or beside the title where there is no tab bar.
  const barOnPhones = !!nav && nav.phone !== "none";
  const titleSwitch = inBanner && !(nav && barOnPhones) && (
    <div className={`absolute top-0 ${options.titlePosition === "right" ? "left-4 md:left-8" : "right-4 md:right-8"}${nav ? " md:hidden" : ""}`}>
      <ThemeSwitcher placement="banner" />
    </div>
  );
  // Keeps the title clear of the switch (only on phones when the tab bar has it from md up);
  // a centered title on both sides, so it stays in the middle.
  const titlePad = !titleSwitch
    ? "px-4 md:px-8"
    : { left: `pl-4 pr-16 ${nav ? "md:px-8" : "md:pl-8 md:pr-20"}`, center: `px-16 ${nav ? "md:px-8" : "md:px-20"}`, right: `pl-16 pr-4 ${nav ? "md:px-8" : "md:pl-20 md:pr-8"}` }[options.titlePosition];
  const title = (bg: string) => (
    <div className={`${bg} pt-6 md:pt-8 pb-3 md:pb-4`}>
      <div className={`relative w-full ${width} mx-auto ${titlePad}`}>
        {brand}
        {titleSwitch}
      </div>
    </div>
  );
  const menuBar = nav?.phone === "menu";
  const bar = nav && (
    <div
      ref={barRef}
      className={`${width} mx-auto ${nav.variant === "jump" ? "px-2 md:px-8" : "px-4 md:px-8 pt-2 pb-2"} flex items-center gap-3 ${menuBar ? "h-[47px] md:h-auto" : ""}`}
    >
      {/* Keeps centered tabs in the middle of the page when the switch is at the other end. */}
      {inBanner && options.tabsPosition === "center" && nav.variant !== "uniform" && <span className="hidden md:block w-9 shrink-0" aria-hidden />}
      {strip(nav.items, options.tabsPosition, nav.phone === "strip" ? "" : "hidden md:flex")}
      {menuBar && (
        <div className="flex md:hidden items-center gap-4 flex-1 min-w-0">
          {nav.menuButton}
          {nav.current}
        </div>
      )}
      {inBanner && <ThemeSwitcher placement="banner" />}
    </div>
  );
  const barPhones = barOnPhones ? "" : " hidden md:block";

  if (keepTabs) {
    return (
      <>
        <div className={`${BLEED}${scope}`}>{title("bg-header")}</div>
        {bar && (
          <div
            ref={setElement}
            className={`sticky top-0 z-50 ${BLEED} bg-tab-bar ${EDGE}${scope}${barPhones}`}
          >
            {bar}
          </div>
        )}
      </>
    );
  }
  return (
    <div ref={setElement} className={`sticky top-0 z-50 ${BLEED} bg-tab-bar ${EDGE}${scope}${autohide}`}>
      {title("")}
      {bar && <div className={barPhones}>{bar}</div>}
    </div>
  );
}
