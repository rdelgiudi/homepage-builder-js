"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/widgets/shared";
import { renderSection } from "@/widgets/registry";
import type { WidgetContext } from "@/widgets/types";
import type { Tab } from "@/lib/schema/config";

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
  enableTransitions?: boolean;
  /** Site-wide values handed to every widget. */
  widgetContext: WidgetContext;
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export default function Tabs({ tabs, enableTransitions, widgetContext }: TabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(0);
  const [mountedTab, setMountedTab] = useState(0);
  const [visible, setVisible] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const [drawerTop, setDrawerTop] = useState(0);
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
    setDrawerTop(barRef.current?.getBoundingClientRect().top ?? 0);
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
    const newUrl = `${window.location.pathname}?tab=${slugify(tabs[index].label)}`;
    router.push(newUrl, { scroll: false });

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

  if (tabs.length === 0) return null;

  return (
    <div className="w-full">
      <div ref={barRef} className="sticky top-0 z-50 w-screen ml-[calc(50%-50vw)] bg-tab-bar border-b border-gray-300 dark:border-gray-700 h-12 md:h-auto">
        <div className="max-w-[870px] mx-auto px-4 md:px-8 flex items-center gap-3 pt-2 pb-2 h-full">
          {/* Desktop tab bar */}
          <div className="hidden md:flex gap-4 justify-center flex-1">
            {tabs.map((tab, index) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabClick(index)}
                className={`flex items-center gap-2 px-4 py-2 transition-all duration-200 ${
                  activeTab === index
                    ? "text-blue-600 dark:text-white border-b-2 border-blue-600 dark:border-blue-400"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:scale-105 gradient-tab"
                }`}
              >
                {tab.icon && <Icon icon={tab.icon} invertDark={tab.invertDark} />}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Mobile: hamburger + current tab label (pinned to the tab bar) */}
          <div className="flex md:hidden items-center gap-4 flex-1">
            <HamburgerButton open={menuOpen} onClick={() => setMenuOpen((o) => !o)} label={menuOpen ? "Close menu" : "Open menu"} />
            <span className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
              {tabs[activeTab].icon && <Icon icon={tabs[activeTab].icon} invertDark={tabs[activeTab].invertDark} width={18} height={18} />}
              <span className="truncate">{tabs[activeTab].label}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Mobile side drawer — starts at the tab bar's level (drawerTop) so the title above stays visible; the bar (z-50) sits on top so its morphing close button remains in view */}
      <div className={`fixed inset-x-0 bottom-0 z-40 md:hidden transition-opacity duration-300 ${menuOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`} style={{ top: drawerTop }}>
        <div
          className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${menuOpen ? "opacity-100" : "opacity-0"}`}
          onClick={() => setMenuOpen(false)}
        />
        <div className={`absolute left-0 top-0 h-full w-72 max-w-[80vw] bg-page shadow-2xl border-r border-gray-300 dark:border-gray-700 flex flex-col transition-transform duration-300 ease-out ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <nav className="flex-1 overflow-y-auto pt-12 pb-2">
            {tabs.map((tab, index) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabClick(index)}
                className={`flex items-center gap-3 w-full px-4 py-3 text-left transition-colors ${
                  activeTab === index
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

      <div
        className={`space-y-6 md:space-y-8 pt-4${enableTransitions ? ' transition-all duration-100 ease-out' : ''} ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
        }`}
      >
        {tabs[mountedTab].sections.map((section, index) => (
          <div
            key={section.id}
            className={enableTransitions && visible ? "animate-fade-in-up" : ""}
            style={enableTransitions && visible ? { animationDelay: `${index * 0.07}s` } : undefined}
          >
            {renderSection(section, widgetContext)}
          </div>
        ))}
      </div>
    </div>
  );
}
