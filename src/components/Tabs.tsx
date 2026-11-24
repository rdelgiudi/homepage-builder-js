"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/widgets/shared";
import TabSections, { type GridOptions } from "@/components/TabSections";
import type { WidgetContext } from "@/widgets/types";
import type { Tab } from "@/lib/schema/config";
import Banner, { type BannerSetup } from "./Banner";
import ThemeSwitcher from "./ThemeSwitcher";
import { reportPreviewTab } from "./ConfigSync";

function HamburgerButton({ open, onClick, label, className = "" }: { open: boolean; onClick: () => void; label: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-expanded={open}
      className={`relative p-2 -mr-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors ${className}`}
    >
      <span className="block w-6 h-6 relative">
        <span className={`absolute left-0 top-1/2 w-6 h-0.5 rounded-full bg-current transition-all duration-300 ease-out ${open ? "rotate-45" : "-translate-y-2"}`} />
        <span className={`absolute left-0 top-1/2 w-6 h-0.5 rounded-full bg-current transition-all duration-200 ease-out ${open ? "opacity-0" : "opacity-100"}`} />
        <span className={`absolute left-0 top-1/2 w-6 h-0.5 rounded-full bg-current transition-all duration-300 ease-out ${open ? "-rotate-45" : "translate-y-2"}`} />
      </span>
    </button>
  );
}

interface TabsProps {
  tabs: Tab[];
  /** The title and how the banner (which holds the tab bar) is laid out. */
  banner: BannerSetup;
  enableTransitions?: boolean;
  /** Site-wide values handed to every widget. */
  widgetContext: WidgetContext;
  /** Max-width class of the page column; the full-bleed tab bar aligns its content to it. */
  widthClass: string;
  /**
   * `top` — horizontal tab bar. `side` — from `md` up the tabs are a sticky left column
   * (below `sideHeader`); below `md` it falls back to the same compact bar + drawer.
   */
  nav?: "top" | "side";
  sideHeader?: ReactNode;
  /** Hide the navigation entirely when there is only one tab. */
  hideNavIfSingle?: boolean;
  grid?: GridOptions;
  /** Phones: `menu` = compact bar + drawer, `bottom` = a tab bar fixed at the bottom of the screen. */
  mobileNav?: "menu" | "bottom";
  /**
   * Profile layout: a pinned tab's widgets, shown in a sticky column beside the open tab
   * (above it on phones). The tab bar stays full width above both.
   */
  column?: ReactNode;
  /**
   * The same navigation at every width (link in bio): one scrolling row of small tabs, also
   * on phones (no menu button and drawer).
   */
  uniformNav?: boolean;
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export default function Tabs({ tabs, banner, enableTransitions, widgetContext, widthClass, nav = "top", sideHeader, hideNavIfSingle, grid, mobileNav = "menu", column, uniformNav = false }: TabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(0);
  const [mountedTab, setMountedTab] = useState(0);
  const [visible, setVisible] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  // Where the drawer starts (level with the menu button's row) and how tall that row is.
  const [drawer, setDrawer] = useState({ top: 0, bar: 48 });
  const transitioning = useRef(false);

  useEffect(() => {
    if (transitioning.current) return;
    const tabParam = searchParams.get("tab");
    if (tabParam) {
      const index = tabs.findIndex((t) => slugify(t.label) === tabParam);
      if (index !== -1 && index !== mountedTab) {
        setActiveTab(index);
        setMountedTab(index);
      }
    }
  }, [searchParams, tabs, mountedTab]);

  useEffect(() => {
    if (!menuOpen) return;
    const box = barRef.current?.getBoundingClientRect();
    if (box) setDrawer({ top: box.top, bar: box.height });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [menuOpen]);

  const handleTabClick = (index: number) => {
    if (index === mountedTab || transitioning.current) return;
    setMenuOpen(false);
    setActiveTab(index);
    // Keep the current path (the admin preview lives at /admin/preview) and any other params.
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", slugify(tabs[index].label));
    router.push(`${window.location.pathname}?${params}`, { scroll: false });

    if (enableTransitions) {
      transitioning.current = true;
      setVisible(false);
      setTimeout(() => {
        setMountedTab(index);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setVisible(true);
            transitioning.current = false;
          });
        });
      }, 200);
    } else {
      setMountedTab(index);
    }
  };

  // Bottom bar with more tabs than fit: keep the open one in view (scrolls the bar only).
  useEffect(() => {
    const el = bottomRef.current;
    const button = el?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!el || !button || el.scrollWidth <= el.clientWidth) return;
    el.scrollTo({ left: Math.max(0, button.offsetLeft - (el.clientWidth - button.offsetWidth) / 2), behavior: "smooth" });
  }, [activeTab]);

  // Admin preview: the builder opens the tab chosen here. Not on mount: the first render is
  // always tab 0, before `?tab=` has been applied.
  const shownTab = tabs[Math.min(activeTab, tabs.length - 1)];
  const activeSlug = shownTab ? slugify(shownTab.label) : "";
  const reported = useRef(false);
  useEffect(() => {
    if (!reported.current) {
      reported.current = true;
      return;
    }
    if (activeSlug) reportPreviewTab(activeSlug);
  }, [activeSlug]);

  if (tabs.length === 0) return null;
  // The tab list can change under us (live config refresh, admin preview) — never index past it.
  const activeIndex = Math.min(activeTab, tabs.length - 1);
  const mountedIndex = Math.min(mountedTab, tabs.length - 1);

  const side = nav === "side";
  const showNav = !(hideNavIfSingle && tabs.length === 1);
  const bottom = showNav && mobileNav === "bottom";

  return (
    <div className={side ? "w-full md:grid md:grid-cols-[230px_minmax(0,1fr)] md:gap-10" : "w-full"}>
      {side && (
        <aside className="hidden md:flex flex-col gap-8 sticky top-0 self-start max-h-screen overflow-y-auto py-10">
          {banner.options.themeSwitch === "banner" ? (
            // Beside the title: below the tabs it would end up over the counters in a short window.
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">{sideHeader}</div>
              <ThemeSwitcher placement="banner" />
            </div>
          ) : (
            sideHeader
          )}
          {showNav && (
            <nav className="flex flex-col gap-1" aria-label="Tabs">
              {tabs.map((tab, index) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabClick(index)}
                  aria-current={activeIndex === index ? "page" : undefined}
                  className={`flex items-center gap-3 px-3 py-2 text-left border-l-2 transition-colors duration-200 ${
                    activeIndex === index
                      ? "text-blue-600 dark:text-white border-blue-600 dark:border-blue-400"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white border-transparent"
                  }`}
                >
                  {tab.icon && <Icon icon={tab.icon} invertDark={tab.invertDark} width={20} height={20} />}
                  <span className="truncate">{tab.label}</span>
                </button>
              ))}
            </nav>
          )}
        </aside>
      )}
      <div className="min-w-0">
      <Banner
        {...banner}
        widthClass={widthClass}
        phonesOnly={side}
        barRef={barRef}
        nav={
          showNav
            ? {
                variant: uniformNav ? "uniform" : "tabs",
                items: tabs,
                activeId: tabs[activeIndex].id,
                onSelect: (id) => handleTabClick(tabs.findIndex((t) => t.id === id)),
                label: "Tabs",
                phone: uniformNav ? "strip" : bottom ? "none" : "menu",
                menuButton: <HamburgerButton open={menuOpen} onClick={() => setMenuOpen((o) => !o)} label={menuOpen ? "Close menu" : "Open menu"} />,
                current: (
                  <span className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
                    {tabs[activeIndex].icon && <Icon icon={tabs[activeIndex].icon} invertDark={tabs[activeIndex].invertDark} width={18} height={18} />}
                    <span className="truncate">{tabs[activeIndex].label}</span>
                  </span>
                ),
              }
            : undefined
        }
      />

      {/* Mobile side drawer — starts at the tab bar's level so the title above stays visible; the bar (z-50) sits on top so its morphing close button remains in view */}
      <div className={`fixed inset-x-0 bottom-0 z-40 md:hidden transition-opacity duration-300 ${menuOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`} style={{ top: drawer.top }}>
        <div
          className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${menuOpen ? "opacity-100" : "opacity-0"}`}
          onClick={() => setMenuOpen(false)}
        />
        <div className={`absolute left-0 top-0 h-full w-72 max-w-[80vw] bg-page shadow-2xl border-r border-gray-300 dark:border-gray-700 flex flex-col transition-transform duration-300 ease-out ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <nav className="flex-1 overflow-y-auto pb-2" style={{ paddingTop: drawer.bar }}>
            {tabs.map((tab, index) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabClick(index)}
                className={`flex items-center gap-3 w-full px-4 py-3 text-left transition-colors ${
                  activeIndex === index
                    ? "text-blue-600 dark:text-white bg-gray-200/60 dark:bg-gray-800/60 border-r-2 border-blue-600 dark:border-blue-400"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-200/40 dark:hover:bg-gray-800/40 border-r-2 border-transparent"
                }`}
              >
                {tab.icon && <Icon icon={tab.icon} invertDark={tab.invertDark} width={20} height={20} />}
                <span className="truncate">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Phones, mobileNav = "bottom": every tab one tap away. SiteShell lifts the page end,
          counters and theme switch above it (main[data-bottom-nav] in globals.css). */}
      {bottom && (
        <nav
          ref={bottomRef}
          className="md:hidden fixed inset-x-0 bottom-0 z-50 flex overflow-x-auto bg-tab-bar border-t border-gray-300 dark:border-gray-700 pb-[env(safe-area-inset-bottom)] ![scrollbar-width:none]"
          aria-label="Tabs"
        >
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabClick(index)}
              aria-current={activeIndex === index ? "page" : undefined}
              className={`flex-1 min-w-[72px] h-[60px] flex flex-col items-center justify-center gap-0.5 px-2 border-t-2 -mt-px text-[11px] leading-tight transition-colors ${
                activeIndex === index ? "text-blue-600 dark:text-white border-blue-600 dark:border-blue-400" : "text-gray-500 dark:text-gray-400 border-transparent"
              }`}
            >
              {tab.icon ? <Icon icon={tab.icon} invertDark={tab.invertDark} width={22} height={22} /> : <span className="h-[22px]" aria-hidden />}
              <span className="max-w-full truncate">{tab.label}</span>
            </button>
          ))}
        </nav>
      )}

      <div className={column ? "md:grid md:grid-cols-[300px_minmax(0,1fr)] md:gap-8 md:items-start" : undefined}>
        {column && (
          // Sticky beside the open tab; scrolls on its own when it is taller than the window.
          <aside className="pt-4 pb-6 md:pb-0 md:sticky md:top-[calc(var(--banner-shown,67px)+13px)] md:max-h-[calc(100dvh-var(--banner-shown,67px)-29px)] motion-safe:transition-[top] motion-safe:duration-300 md:overflow-y-auto md:pr-1 [scrollbar-width:thin]" aria-label="Profile">
            {column}
          </aside>
        )}
        <div
          className={`${side ? "pt-4 md:pt-10" : "pt-4"}${enableTransitions ? ' transition-all duration-100 ease-out' : ''} ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
          }`}
        >
          <TabSections tab={tabs[mountedIndex]} widgetContext={widgetContext} animate={enableTransitions && visible} grid={grid} />
        </div>
      </div>
      </div>
    </div>
  );
}
