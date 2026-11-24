"use client";

import { useEffect, useRef, useState } from "react";
import Banner, { type BannerSetup } from "./Banner";
import { useSearchParams } from "next/navigation";
import type { Tab } from "@/lib/schema/config";
import { Icon } from "@/widgets/shared";
import type { WidgetContext } from "@/widgets/types";
import TabSections, { type GridOptions } from "./TabSections";
import { reportPreviewTab } from "./ConfigSync";

function slugify(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

interface OnePageProps {
  tabs: Tab[];
  /** The title and how the banner (which holds the jump bar) is laid out. */
  banner: BannerSetup;
  widgetContext: WidgetContext;
  widthClass: string;
  grid?: GridOptions;
  /** Each section starts with its tab's icon and name (`layout.sectionHeadings`). */
  headings?: boolean;
}

/**
 * "One page" site layout: every tab is a section of one scrolling page, with a sticky
 * bar that jumps to a section and highlights the one being read.
 */
export default function OnePage({ tabs, banner, widgetContext, widthClass, grid, headings = true }: OnePageProps) {
  const searchParams = useSearchParams();
  const [active, setActive] = useState(tabs[0]?.id ?? "");

  // Admin preview: the builder opens the section being read (jump bar or scrolling). Not on
  // mount: `active` starts at the first tab before `?tab=` scrolls anywhere.
  const activeLabel = tabs.find((t) => t.id === active)?.label;
  const reported = useRef(false);
  useEffect(() => {
    if (!reported.current) {
      reported.current = true;
      return;
    }
    if (activeLabel !== undefined) reportPreviewTab(slugify(activeLabel));
  }, [activeLabel]);

  /** While a jump is animating, the clicked section stays highlighted (timestamp it ends). */
  const jumpUntil = useRef(0);

  // Highlight the section currently crossing the upper part of the viewport.
  useEffect(() => {
    const last = tabs[tabs.length - 1]?.id ?? "";
    const atBottom = () => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
    // The band read as "here": a tenth of the window, starting 15% down, or below a taller banner.
    let observer: IntersectionObserver | null = null;
    const observe = () => {
      observer?.disconnect();
      const main = document.querySelector("main");
      const banner = main ? parseFloat(getComputedStyle(main).getPropertyValue("--banner-h")) || 0 : 0;
      const height = window.innerHeight;
      const top = Math.round(Math.max(height * 0.15, banner + 24));
      const bottom = Math.max(0, Math.round(height * 0.9) - top);
      observer = new IntersectionObserver(
        (entries) => {
          if (Date.now() < jumpUntil.current || atBottom()) return;
          for (const entry of entries) if (entry.isIntersecting) setActive(entry.target.getAttribute("data-tab") ?? "");
        },
        { rootMargin: `-${top}px 0px -${bottom}px 0px` }
      );
      document.querySelectorAll("[data-tab]").forEach((el) => observer?.observe(el));
    };
    observe();
    window.addEventListener("resize", observe);
    // A short last section can never reach the top of the viewport — the end of the page counts as it.
    const onScroll = () => {
      if (Date.now() >= jumpUntil.current && atBottom()) setActive(last);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", observe);
      window.removeEventListener("scroll", onScroll);
    };
  }, [tabs, banner.options]);

  const scrollTo = (tab: Tab, smooth: boolean) => {
    jumpUntil.current = Date.now() + (smooth ? 900 : 100);
    setActive(tab.id);
    const section = document.getElementById(slugify(tab.label));
    if (!section) return;
    // A banner that hides on the way down needs no room above the section; on the way up it returns.
    const gap = parseFloat(getComputedStyle(section).scrollMarginTop) || 0;
    const hides = banner.options.scroll === "hide" && section.getBoundingClientRect().top > gap + 16;
    section.style.scrollMarginTop = hides ? "0px" : "";
    section.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
  };

  // `?tab=<slug>` (shared links, the admin preview) scrolls to that section.
  const tabParam = searchParams.get("tab");
  useEffect(() => {
    const target = tabParam && tabs.find((t) => slugify(t.label) === tabParam);
    if (target) scrollTo(target, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabParam]);

  if (tabs.length === 0) return null;

  return (
    <div className="w-full">
      <Banner
        {...banner}
        widthClass={widthClass}
        nav={
          tabs.length > 1
            ? {
                variant: "jump",
                items: tabs,
                activeId: active,
                onSelect: (id) => {
                  const tab = tabs.find((t) => t.id === id);
                  if (tab) scrollTo(tab, true);
                },
                label: "Sections",
                phone: "strip",
              }
            : undefined
        }
      />

      {tabs.map((tab) => (
        <section key={tab.id} id={slugify(tab.label)} data-tab={tab.id} className="scroll-mt-[var(--banner-h,56px)] pt-10 first:pt-6" aria-label={tab.label}>
          {tabs.length > 1 && headings && (
            <h2 className="flex items-center gap-3 mb-6 text-2xl font-bold text-gray-900 dark:text-white">
              {tab.icon && <Icon icon={tab.icon} invertDark={tab.invertDark} width={28} height={28} />}
              <span>{tab.label}</span>
            </h2>
          )}
          <TabSections tab={tab} widgetContext={widgetContext} grid={grid} />
        </section>
      ))}
    </div>
  );
}
