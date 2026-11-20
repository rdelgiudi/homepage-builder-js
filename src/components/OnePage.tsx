"use client";

import { useEffect, useRef, useState } from "react";
import { useScrollStrip } from "./useScrollStrip";
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
export default function OnePage({ tabs, widgetContext, widthClass, grid, headings = true }: OnePageProps) {
  const searchParams = useSearchParams();
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  // On a phone the jump bar is wider than the screen: it scrolls, keeps the highlighted
  // button in view and fades the edges with more buttons beyond.
  const strip = useScrollStrip<HTMLDivElement>(active, tabs.length);

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
    const observer = new IntersectionObserver(
      (entries) => {
        if (Date.now() < jumpUntil.current || atBottom()) return;
        for (const entry of entries) if (entry.isIntersecting) setActive(entry.target.getAttribute("data-tab") ?? "");
      },
      { rootMargin: "-15% 0px -75% 0px" }
    );
    document.querySelectorAll("[data-tab]").forEach((el) => observer.observe(el));
    // A short last section can never reach the top of the viewport — the end of the page counts as it.
    const onScroll = () => {
      if (Date.now() >= jumpUntil.current && atBottom()) setActive(last);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [tabs]);

  const scrollTo = (tab: Tab, smooth: boolean) => {
    jumpUntil.current = Date.now() + (smooth ? 900 : 100);
    setActive(tab.id);
    document.getElementById(slugify(tab.label))?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
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
      {tabs.length > 1 && (
        <nav className="sticky top-0 z-50 w-screen ml-[calc(50%-50vw)] bg-tab-bar border-b border-gray-300 dark:border-gray-700" aria-label="Sections">
          {/* `is-centered` (safe center): centred when it fits, but never pushes the first buttons out of reach when it doesn't. */}
          <div
            ref={strip.ref}
            className={`scroll-strip is-centered ${widthClass} mx-auto px-2 md:px-8 relative flex gap-1 md:gap-4 overflow-x-auto`}
            style={strip.style}
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                data-jump={tab.id}
                onClick={() => scrollTo(tab, true)}
                aria-current={active === tab.id ? "true" : undefined}
                className={`flex shrink-0 items-center gap-1.5 md:gap-2 px-2.5 md:px-4 py-2.5 md:py-3 text-sm md:text-base whitespace-nowrap border-b-2 transition-colors duration-200 ${
                  active === tab.id
                    ? "text-blue-600 dark:text-white border-blue-600 dark:border-blue-400"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white border-transparent"
                }`}
              >
                {tab.icon && <Icon icon={tab.icon} invertDark={tab.invertDark} width={18} height={18} />}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </nav>
      )}

      {tabs.map((tab) => (
        <section key={tab.id} id={slugify(tab.label)} data-tab={tab.id} className="scroll-mt-14 pt-10 first:pt-6" aria-label={tab.label}>
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
